/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type OutboxRow = {
  id: string;
  user_id: string;
  channel: "email" | "sms" | "push" | "in_app";
  template: string;
  payload: Record<string, unknown>;
  status: "pending" | "sending" | "sent" | "failed";
  attempts: number;
  dedupe_key: string | null;
  created_at: string;
};

function mustGetEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildUnsubscribeFooter(appBaseUrl: string) {
  const settingsUrl = `${appBaseUrl.replace(/\/$/, "")}/settings`;
  return `
    <hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb"/>
    <div style="font-size:11px;color:#9ca3af;margin-top:12px;line-height:1.5">
      <p style="margin:0 0 4px 0">BreachPay alerts · <a href="${settingsUrl}" style="color:#6b7280;text-decoration:underline">Manage email preferences</a></p>
      <p style="margin:0 0 4px 0">You are receiving this because you opted in to email alerts on BreachPay.</p>
      <p style="margin:0">To stop receiving these emails, <a href="${settingsUrl}" style="color:#6b7280;text-decoration:underline">unsubscribe here</a>.</p>
      <p style="margin:8px 0 0 0">BreachPay is not a law firm. All data comes from third-party sources.</p>
    </div>
  `;
}

// Emails about payouts are only sent when BreachPay actually handles payouts.
// It does not today: settlement administrators pay claimants directly.
const PAYOUT_TEMPLATES = new Set(["claim_approved", "claim_paid", "payout_paid"]);
const PAYOUTS_ENABLED = Deno.env.get("PAYOUTS_ENABLED") === "true";

function buildEmailHtml(
  template: OutboxRow["template"],
  payload: Record<string, unknown>,
  appBaseUrl: string
) {
  const base = appBaseUrl.replace(/\/$/, "");
  // Settlement names/companies originate from scraped third-party pages, so
  // they are escaped before being placed in email HTML.
  const rawSettlementName = String(payload.settlement_name ?? "a settlement");
  const settlementName = escapeHtml(rawSettlementName);
  const company = escapeHtml(payload.company ?? "");
  const daysLeft = Number(payload.days_left);
  const hasDaysLeft = Number.isFinite(daysLeft) && daysLeft >= 0;

  const matchesUrl = `${base}/settlements`;
  const footer = buildUnsubscribeFooter(appBaseUrl);
  const wrap = (inner: string) =>
    `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px;line-height:1.5">${inner}${footer}</div>`;
  const link = (href: string, text: string) => `<p><a href="${href}" style="color:#2563eb">${text}</a></p>`;
  const who = `<strong>${settlementName}</strong>${company ? ` (${company})` : ""}`;
  const notADecision =
    "<p>Only the settlement administrator can decide whether you are eligible. Filing a claim is free, and you file on the official settlement site.</p>";

  if (template === "new_match") {
    return {
      subject: "A listed settlement may relate to one of your breaches",
      html: wrap(
        `<h2>A settlement that may be related</h2>
        <p>${who} is listed on BreachPay and may relate to a breach found for your email address.</p>
        ${notADecision}
        ${link(matchesUrl, "View your matches")}`
      ),
    };
  }

  if (template === "deadline_soon") {
    const when = hasDaysLeft ? (daysLeft === 1 ? "1 day" : `${daysLeft} days`) : "";
    return {
      subject: when ? `${when} left to file: ${rawSettlementName}` : `Claim deadline approaching: ${rawSettlementName}`,
      html: wrap(
        `<h2>A claim deadline is coming up</h2>
        <p>${when ? `There ${daysLeft === 1 ? "is" : "are"} <strong>${when}</strong> left to file a claim in ${who}.` : `The deadline to file a claim in ${who} is approaching.`}</p>
        <p>Check the date on the official settlement site, since deadlines can change. Filing is free.</p>
        ${link(matchesUrl, "View your matches")}`
      ),
    };
  }

  if (template === "scan_complete") {
    return {
      subject: "Your BreachPay breach check is complete",
      html: wrap(
        `<h2>Breach check complete</h2>
        ${payload.breaches ? `<p>Known breaches that include your email: <strong>${escapeHtml(payload.breaches)}</strong></p>` : ""}
        ${link(`${base}/scan`, "See the results")}`
      ),
    };
  }

  if (template === "claim_submitted") {
    return {
      subject: `You marked your claim as filed: ${rawSettlementName}`,
      html: wrap(
        `<h2>Saved to your claims</h2>
        <p>You marked your claim in ${who} as filed.</p>
        <p>BreachPay does not file or process claims. The settlement administrator will contact you directly about yours, so keep your confirmation number.</p>
        ${link(`${base}/claims`, "View your claims")}`
      ),
    };
  }

  // Everything else (including payout templates, when enabled): a plain status note.
  return {
    subject: `Claim update: ${rawSettlementName}`,
    html: wrap(
      `<h2>Claim record updated</h2>
      <p>Your claim record for ${who} was updated in BreachPay.</p>
      <p>Status: <strong>${escapeHtml(String(payload.new_status ?? template).replace(/_/g, " "))}</strong></p>
      ${link(`${base}/claims`, "View your claims")}`
    ),
  };
}

async function sendResendEmail(to: string, subject: string, html: string) {
  const apiKey = mustGetEnv("RESEND_API_KEY");
  const from = mustGetEnv("RESEND_FROM_EMAIL");

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Resend error ${resp.status}: ${text}`);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Access control ──────────────────────────────────────────────────────────
// verify_jwt is off for this function, so it must authenticate callers itself.
// Allowed: (1) scheduled jobs sending the x-cron-secret header that matches the
// CRON_SECRET function secret, (2) a signed-in admin user.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

async function requireAdminOrCron(req: Request): Promise<Response | null> {
  const deny = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (cronSecret && providedSecret && timingSafeEqual(providedSecret, cronSecret)) {
    return null;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return deny(401, "Unauthorized");

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return deny(500, "Missing env");

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return deny(401, "Unauthorized");

  const { data: roleRow } = await createClient(url, serviceKey)
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return deny(403, "Forbidden");

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireAdminOrCron(req);
  if (denied) return denied;

  try {
    const supabaseUrl = mustGetEnv("SUPABASE_URL");
    const serviceKey = mustGetEnv("SUPABASE_SERVICE_ROLE_KEY");
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://breachpay.com";
    const batchSize = Number(Deno.env.get("DISPATCH_BATCH_SIZE") ?? "50");

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // 1) Claim a batch from outbox (status pending -> sending)
    const { data: claimed, error: claimErr } = await supabase.rpc(
      "proc_claim_outbox",
      { batch_size: batchSize }
    );

    if (claimErr) throw new Error(`Claim outbox failed: ${claimErr.message}`);

    const rows = (claimed ?? []) as OutboxRow[];
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, claimed: 0, sent: 0, failed: 0, skipped: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // Pre-fetch email_alerts preferences for all unique users in batch
    const uniqueUserIds = [...new Set(rows.filter(r => r.channel === "email").map(r => r.user_id))];
    const userPrefs: Record<string, boolean> = {};

    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("user_id, email_alerts")
        .in("user_id", uniqueUserIds);

      if (profiles) {
        for (const p of profiles) {
          userPrefs[p.user_id] = p.email_alerts ?? true;
        }
      }
    }

    for (const row of rows) {
      try {
        if (row.channel === "email") {
          // ── CAN-SPAM: enforce email_alerts opt-in ──
          const optedIn = userPrefs[row.user_id] ?? false;
          if (!optedIn) {
            // User has not opted in — skip and mark as sent (no retry)
            await supabase
              .from("notification_outbox")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                last_error: "skipped:email_alerts_off",
              })
              .eq("id", row.id);
            skipped += 1;
            continue;
          }

          // Payout emails describe money BreachPay does not handle; never send them
          // unless payouts have been switched on for this deployment.
          if (PAYOUT_TEMPLATES.has(row.template) && !PAYOUTS_ENABLED) {
            await supabase
              .from("notification_outbox")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                last_error: "skipped:payouts_disabled",
              })
              .eq("id", row.id);
            skipped += 1;
            continue;
          }

          // Look up user's email via auth admin
          const { data: userRes, error: userErr } =
            await supabase.auth.admin.getUserById(row.user_id);
          if (userErr)
            throw new Error(`Get user email failed: ${userErr.message}`);
          const to = userRes.user?.email;
          if (!to) throw new Error("User has no email");

          const { subject, html } = buildEmailHtml(
            row.template,
            row.payload as Record<string, unknown>,
            appBaseUrl
          );
          await sendResendEmail(to, subject, html);
        }

        // in_app is already "delivered" by virtue of being created — just mark sent
        await supabase
          .from("notification_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", row.id);

        sent += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Exponential backoff: 5min * attempts
        const backoffMinutes = 5 * (row.attempts + 1);
        const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();
        await supabase
          .from("notification_outbox")
          .update({
            status: "pending",
            last_error: msg,
            next_attempt_at: nextAttemptAt,
          })
          .eq("id", row.id);
        failed += 1;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, claimed: rows.length, sent, failed, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
