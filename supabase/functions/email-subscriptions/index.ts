// Email reminders and the weekly digest, for people without an account.
//
//   POST { action: "subscribe", email, kind: "deadline" | "weekly", settlement_id? }
//   POST { action: "confirm", token }
//   POST { action: "unsubscribe", token }
//   POST ?action=unsubscribe&token=...   (one-click unsubscribe from mail apps)
//
// Every new address must be confirmed from a link we email to it before any
// reminder is sent (double opt-in). Responses never reveal whether an address
// was already subscribed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Sign-ups allowed per requester per hour. */
const MAX_SIGNUPS_PER_HOUR = 10;
/** Minimum time between confirmation emails to one address. */
const CONFIRM_COOLDOWN_MS = 10 * 60_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function siteUrl(): string {
  return (Deno.env.get("APP_BASE_URL") || "https://breachpay.com").replace(/\/$/, "");
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function layout(inner: string, unsubscribeUrl?: string) {
  const footer = unsubscribeUrl
    ? `<p style="margin:0 0 4px 0"><a href="${unsubscribeUrl}" style="color:#6b7280">Unsubscribe</a> from these emails.</p>`
    : "";
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:auto;padding:24px;line-height:1.5;color:#111827">
    ${inner}
    <hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb"/>
    <div style="font-size:12px;color:#6b7280;margin-top:12px">
      ${footer}
      <p style="margin:0">BreachPay is an independent directory, not a law firm or settlement administrator. Filing a claim is free.</p>
    </div>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string, unsubscribeOneClick?: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) throw new Error("Email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).");
  const headers: Record<string, string> = {};
  if (unsubscribeOneClick) {
    headers["List-Unsubscribe"] = `<${unsubscribeOneClick}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, headers }),
  });
  if (!resp.ok) throw new Error(`Resend error ${resp.status}: ${await resp.text()}`);
}

type Db = ReturnType<typeof createClient>;

interface PublishedSettlement {
  id: string;
  name: string;
  company: string;
  claim_deadline: string | null;
}

/** A published settlement that is still open, with a future claim deadline. */
async function openSettlement(db: Db, id: string): Promise<PublishedSettlement | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from("settlements")
    .select("id, name, company, claim_deadline")
    .eq("id", id)
    .eq("verified", true)
    .eq("is_demo", false)
    .eq("is_test", false)
    .in("status", ["verified", "open"])
    .gte("claim_deadline", today)
    .maybeSingle();
  return (data as PublishedSettlement | null) ?? null;
}

function unsubscribeLinks(token: string) {
  const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-subscriptions`;
  return {
    page: `${siteUrl()}/email/unsubscribe?token=${token}`,
    oneClick: `${fnBase}?action=unsubscribe&token=${token}`,
  };
}

async function subscribe(db: Db, req: Request, body: Record<string, unknown>) {
  const email = String(body.email ?? "").trim().toLowerCase();
  const kind = body.kind === "weekly" ? "weekly" : body.kind === "deadline" ? "deadline" : null;
  const settlementId = kind === "deadline" ? String(body.settlement_id ?? "") : null;

  if (!EMAIL_RE.test(email) || email.length > 254) return json({ ok: false, error: "Please enter a valid email address." }, 400);
  if (!kind) return json({ ok: false, error: "Unknown subscription type." }, 400);
  if (kind === "deadline" && !UUID_RE.test(settlementId!)) return json({ ok: false, error: "Unknown settlement." }, 400);

  // Limit sign-ups per requester. Only a salted hash of the address is kept.
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const salt = Deno.env.get("SUBSCRIBE_SALT") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.slice(-16);
  const requesterHash = await sha256Hex(`${salt}:${ip}`);
  const { count: recent } = await db
    .from("email_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("requester_hash", requesterHash)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  if ((recent ?? 0) >= MAX_SIGNUPS_PER_HOUR) {
    return json({ ok: false, error: "Too many sign-ups from here. Please try again later." }, 429);
  }

  let settlement: PublishedSettlement | null = null;
  if (kind === "deadline") {
    settlement = await openSettlement(db, settlementId!);
    if (!settlement) return json({ ok: false, error: "This settlement isn't open for reminders." }, 400);
  }

  // Has this address already confirmed any subscription?
  const { data: confirmedRows } = await db
    .from("email_subscriptions")
    .select("id")
    .eq("email", email)
    .not("confirmed_at", "is", null)
    .limit(1);
  const addressConfirmed = (confirmedRows ?? []).length > 0;

  let query = db.from("email_subscriptions").select("*").eq("email", email).eq("kind", kind);
  query = settlementId ? query.eq("settlement_id", settlementId) : query.is("settlement_id", null);
  const { data: existing } = await query.maybeSingle();

  const now = new Date().toISOString();
  const what =
    kind === "deadline"
      ? `a reminder before the claim deadline for <strong>${escapeHtml(settlement!.name)}</strong>${
          formatDate(settlement!.claim_deadline) ? ` (${escapeHtml(formatDate(settlement!.claim_deadline))})` : ""
        }`
      : "a weekly email with newly listed settlements and upcoming claim deadlines";

  // Already active: say the same thing as for a new sign-up, send nothing.
  if (existing?.confirmed_at && !existing.unsubscribed_at) return json({ ok: true });

  // Someone who unsubscribed from this before must confirm again.
  if (addressConfirmed && !existing?.unsubscribed_at) {
    // The address is already verified, so the new subscription starts now and
    // the owner gets a note (with an unsubscribe link) instead of a confirm link.
    const { data: row, error } = existing
      ? await db
          .from("email_subscriptions")
          .update({ confirmed_at: now, unsubscribed_at: null, confirm_token_hash: null, updated_at: now })
          .eq("id", existing.id)
          .select("unsubscribe_token")
          .single()
      : await db
          .from("email_subscriptions")
          .insert({ email, kind, settlement_id: settlementId, confirmed_at: now, requester_hash: requesterHash })
          .select("unsubscribe_token")
          .single();
    if (error || !row) throw error ?? new Error("Could not save the subscription.");
    const links = unsubscribeLinks(row.unsubscribe_token);
    await sendEmail(
      email,
      kind === "deadline" ? `Reminder set: ${settlement!.name}` : "You're subscribed to the BreachPay weekly email",
      layout(`<h2>You're all set</h2><p>You'll get ${what}.</p><p>If you didn't ask for this, use the unsubscribe link below.</p>`, links.page),
      links.oneClick,
    );
    return json({ ok: true });
  }

  // New address: send a confirmation link, at most once every few minutes.
  if (existing?.confirm_sent_at && Date.now() - new Date(existing.confirm_sent_at).getTime() < CONFIRM_COOLDOWN_MS) {
    return json({ ok: true });
  }
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const { error } = existing
    ? await db
        .from("email_subscriptions")
        .update({ confirm_token_hash: tokenHash, confirm_sent_at: now, unsubscribed_at: null, updated_at: now })
        .eq("id", existing.id)
    : await db.from("email_subscriptions").insert({
        email,
        kind,
        settlement_id: settlementId,
        confirm_token_hash: tokenHash,
        confirm_sent_at: now,
        requester_hash: requesterHash,
      });
  if (error) throw error;

  const confirmUrl = `${siteUrl()}/email/confirm?token=${token}`;
  await sendEmail(
    email,
    "Confirm your email for BreachPay",
    layout(
      `<h2>Confirm your email</h2>
      <p>Someone, hopefully you, asked BreachPay to send ${what} to this address.</p>
      <p><a href="${confirmUrl}" style="display:inline-block;background:#10b981;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Confirm my email</a></p>
      <p style="font-size:13px;color:#6b7280">If you didn't ask for this, ignore this email and nothing more will be sent.</p>`,
    ),
  );
  return json({ ok: true });
}

async function confirm(db: Db, body: Record<string, unknown>) {
  const token = String(body.token ?? "");
  if (!/^[0-9a-f]{48}$/.test(token)) return json({ ok: false, error: "This link isn't valid." }, 400);
  const tokenHash = await sha256Hex(token);
  const { data: row } = await db
    .from("email_subscriptions")
    .select("id, kind, settlement_id, confirm_sent_at")
    .eq("confirm_token_hash", tokenHash)
    .maybeSingle();
  if (!row) return json({ ok: false, error: "This link has already been used or isn't valid." }, 404);
  if (row.confirm_sent_at && Date.now() - new Date(row.confirm_sent_at).getTime() > 7 * 86_400_000) {
    return json({ ok: false, error: "This link has expired. Please sign up again." }, 410);
  }
  const now = new Date().toISOString();
  await db
    .from("email_subscriptions")
    .update({ confirmed_at: now, unsubscribed_at: null, confirm_token_hash: null, updated_at: now })
    .eq("id", row.id);

  let settlement: PublishedSettlement | null = null;
  if (row.settlement_id) settlement = await openSettlement(db, row.settlement_id);
  return json({
    ok: true,
    kind: row.kind,
    settlement: settlement ? { id: settlement.id, name: settlement.name, company: settlement.company, claim_deadline: settlement.claim_deadline } : null,
  });
}

async function unsubscribe(db: Db, token: string) {
  if (!/^[0-9a-f]{48}$/.test(token)) return json({ ok: false, error: "This link isn't valid." }, 400);
  const now = new Date().toISOString();
  const { data } = await db
    .from("email_subscriptions")
    .update({ unsubscribed_at: now, updated_at: now })
    .eq("unsubscribe_token", token)
    .select("kind")
    .maybeSingle();
  if (!data) return json({ ok: false, error: "This link isn't valid." }, 404);
  return json({ ok: true, kind: data.kind });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  try {
    // One-click unsubscribe from mail apps: POST to the link with a form body.
    const url = new URL(req.url);
    if (url.searchParams.get("action") === "unsubscribe") {
      return await unsubscribe(db, url.searchParams.get("token") ?? "");
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    switch (body.action) {
      case "subscribe":
        return await subscribe(db, req, body);
      case "confirm":
        return await confirm(db, body);
      case "unsubscribe":
        return await unsubscribe(db, String(body.token ?? ""));
      default:
        return json({ ok: false, error: "Unknown action." }, 400);
    }
  } catch (e) {
    console.error("email-subscriptions error:", e);
    return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
  }
});
