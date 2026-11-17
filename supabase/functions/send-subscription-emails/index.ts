// Sends confirmed email subscriptions: deadline reminders (default) and the
// weekly digest (?mode=weekly). Runs on a schedule with the x-cron-secret
// header, or by an admin. Only published settlements are ever mentioned.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/** Days before the deadline when reminders go out. */
const REMINDER_DAYS = [7, 1];
const BATCH = 500;

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const siteUrl = () => (Deno.env.get("APP_BASE_URL") || "https://breachpay.com").replace(/\/$/, "");

function slugify(input: string): string {
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ")
    .replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");
}

/** Mirrors settlementPath() in the web app. */
export function settlementUrl(s: { id: string; name: string; company: string }) {
  const name = s.name.trim();
  const company = s.company.trim();
  const display = !company || name.toLowerCase().includes(company.toLowerCase()) ? name : `${company}: ${name}`;
  return `${siteUrl()}/settlement/${slugify(display) || "settlement"}-${s.id.slice(0, 8).toLowerCase()}`;
}

function formatDate(value: string | null): string {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!m) return "";
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function daysUntil(value: string | null): number | null {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  if (!m) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - today) / 86_400_000);
}

function payout(s: { payout_min: number | null; payout_max: number | null }): string | null {
  const min = s.payout_min && s.payout_min > 0 ? s.payout_min : null;
  const max = s.payout_max && s.payout_max > 0 ? s.payout_max : null;
  const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;
  if (min && max && min !== max) return `${fmt(Math.min(min, max))} – ${fmt(Math.max(min, max))}`;
  const one = max ?? min;
  return one ? `up to ${fmt(one)}` : null;
}

function layout(inner: string, unsubscribePage: string) {
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:auto;padding:24px;line-height:1.5;color:#111827">
    ${inner}
    <hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb"/>
    <div style="font-size:12px;color:#6b7280;margin-top:12px">
      <p style="margin:0 0 4px 0">You confirmed these emails on BreachPay. <a href="${unsubscribePage}" style="color:#6b7280">Unsubscribe</a>.</p>
      <p style="margin:0">BreachPay is an independent directory, not a law firm or settlement administrator. Always check the official settlement site. Filing a claim is free.</p>
    </div>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string, token: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) throw new Error("RESEND_API_KEY / RESEND_FROM_EMAIL not set");
  const oneClick = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-subscriptions?action=unsubscribe&token=${token}`;
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  if (!resp.ok) throw new Error(`Resend error ${resp.status}: ${await resp.text()}`);
}

const PUBLISHED = (q: any) =>
  q.eq("verified", true).eq("is_demo", false).eq("is_test", false).in("status", ["verified", "open"]);

const SETTLEMENT_FIELDS = "id, name, company, claim_deadline, payout_min, payout_max, status, verified, is_demo, is_test, lifecycle_status";

/**
 * Which reminder to send today, if any: the closest reminder point we have
 * reached that hasn't gone out. Returns null when nothing is due.
 */
export function dueReminder(daysLeft: number, alreadySent: number[]): number | null {
  if (daysLeft < 0) return null;
  const due = REMINDER_DAYS.filter((d) => daysLeft <= d && !alreadySent.includes(d)).sort((a, b) => a - b)[0];
  return due ?? null;
}

/** Records a reminder as sent, along with any earlier points, so none goes out late. */
export function markSent(alreadySent: number[], due: number): number[] {
  return Array.from(new Set([...alreadySent, ...REMINDER_DAYS.filter((d) => d >= due)])).sort((a, b) => b - a);
}

interface Sub {
  id: string;
  email: string;
  unsubscribe_token: string;
  reminders_sent: number[];
  settlements: {
    id: string; name: string; company: string; claim_deadline: string | null;
    payout_min: number | null; payout_max: number | null; status: string;
    verified: boolean; is_demo: boolean; is_test: boolean; lifecycle_status: string | null;
  } | null;
}

async function sendDeadlineReminders(db: any) {
  // Addresses never confirmed within a week are deleted: we keep nothing
  // about people who didn't finish signing up.
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  await db.from("email_subscriptions").delete().is("confirmed_at", null).lt("created_at", weekAgo);

  const { data, error } = await db
    .from("email_subscriptions")
    .select(`id, email, unsubscribe_token, reminders_sent, settlements(${SETTLEMENT_FIELDS})`)
    .eq("kind", "deadline")
    .not("confirmed_at", "is", null)
    .is("unsubscribed_at", null)
    .limit(BATCH);
  if (error) throw error;

  let sent = 0, skipped = 0, failed = 0;
  for (const sub of (data ?? []) as Sub[]) {
    const s = sub.settlements;
    const published = s && s.verified && !s.is_demo && !s.is_test && ["verified", "open"].includes(s.status) &&
      s.lifecycle_status !== "closed" && s.lifecycle_status !== "archived";
    const days = s ? daysUntil(s.claim_deadline) : null;
    if (!published || days === null || days < 0) { skipped++; continue; }

    const due = dueReminder(days, sub.reminders_sent);
    if (due === null) { skipped++; continue; }

    const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    const amount = payout(s!);
    const unsubscribePage = `${siteUrl()}/email/unsubscribe?token=${sub.unsubscribe_token}`;
    try {
      await sendEmail(
        sub.email,
        `Claim deadline ${when}: ${s!.name}`,
        layout(
          `<h2>The claim deadline is ${escapeHtml(when)}</h2>
          <p>The deadline we have on record to file a claim in <strong>${escapeHtml(s!.name)}</strong> (${escapeHtml(s!.company)}) is <strong>${escapeHtml(formatDate(s!.claim_deadline))}</strong>.</p>
          ${amount ? `<p>Listed payout: ${escapeHtml(amount)} per valid claim. Actual payments can be lower.</p>` : ""}
          <p><a href="${settlementUrl(s!)}" style="display:inline-block;background:#10b981;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">See the settlement and claim link</a></p>
          <p style="font-size:13px;color:#6b7280">Deadlines can change by court order, so confirm the date on the official settlement site. If you've already filed, you can ignore this.</p>`,
          unsubscribePage,
        ),
        sub.unsubscribe_token,
      );
      const marked = markSent(sub.reminders_sent, due);
      await db.from("email_subscriptions").update({ reminders_sent: marked, last_sent_at: new Date().toISOString() }).eq("id", sub.id);
      sent++;
    } catch (e) {
      console.error("deadline reminder failed", sub.id, e);
      failed++;
    }
  }
  return { mode: "deadline", sent, skipped, failed };
}

async function sendWeeklyDigest(db: any) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in14 = new Date(now.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [{ data: added }, { data: closing }] = await Promise.all([
    PUBLISHED(db.from("settlements").select(SETTLEMENT_FIELDS + ", last_verified_at"))
      .gte("last_verified_at", weekAgo)
      .or(`claim_deadline.is.null,claim_deadline.gte.${today}`)
      .order("last_verified_at", { ascending: false })
      .limit(10),
    PUBLISHED(db.from("settlements").select(SETTLEMENT_FIELDS))
      .gte("claim_deadline", today)
      .lte("claim_deadline", in14)
      .order("claim_deadline", { ascending: true })
      .limit(10),
  ]);

  const newOnes = (added ?? []) as NonNullable<Sub["settlements"]>[];
  const closingIds = new Set(newOnes.map((s) => s.id));
  const soon = ((closing ?? []) as NonNullable<Sub["settlements"]>[]).filter((s) => !closingIds.has(s.id));
  if (newOnes.length === 0 && soon.length === 0) return { mode: "weekly", sent: 0, skipped: "nothing new this week" };

  const item = (s: NonNullable<Sub["settlements"]>) => {
    const amount = payout(s);
    const deadline = formatDate(s.claim_deadline);
    return `<li style="margin-bottom:12px"><a href="${settlementUrl(s)}" style="color:#047857;font-weight:600">${escapeHtml(s.name)}</a><br/>
      <span style="color:#6b7280;font-size:14px">${escapeHtml(s.company)}${deadline ? ` · claims close ${escapeHtml(deadline)}` : ""}${amount ? ` · listed payout ${escapeHtml(amount)}` : ""}</span></li>`;
  };
  const body = `
    <h2>This week on BreachPay</h2>
    ${newOnes.length ? `<h3 style="margin-bottom:8px">Listed or reviewed this week</h3><ul style="padding-left:18px">${newOnes.map(item).join("")}</ul>` : ""}
    ${soon.length ? `<h3 style="margin-bottom:8px">Closing in the next two weeks</h3><ul style="padding-left:18px">${soon.map(item).join("")}</ul>` : ""}
    <p><a href="${siteUrl()}/data-breach-settlements" style="color:#047857">See every open settlement</a></p>`;
  const subject = newOnes.length
    ? `${newOnes.length} data breach settlement${newOnes.length === 1 ? "" : "s"} listed or reviewed this week`
    : `${soon.length} settlement deadline${soon.length === 1 ? "" : "s"} in the next two weeks`;

  const sixDaysAgo = new Date(now.getTime() - 6 * 86_400_000).toISOString();
  const { data: subs, error } = await db
    .from("email_subscriptions")
    .select("id, email, unsubscribe_token")
    .eq("kind", "weekly")
    .not("confirmed_at", "is", null)
    .is("unsubscribed_at", null)
    .or(`last_sent_at.is.null,last_sent_at.lt.${sixDaysAgo}`)
    .limit(BATCH);
  if (error) throw error;

  let sent = 0, failed = 0;
  for (const sub of subs ?? []) {
    try {
      await sendEmail(sub.email, subject, layout(body, `${siteUrl()}/email/unsubscribe?token=${sub.unsubscribe_token}`), sub.unsubscribe_token);
      await db.from("email_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("id", sub.id);
      sent++;
    } catch (e) {
      console.error("weekly digest failed", sub.id, e);
      failed++;
    }
  }
  return { mode: "weekly", sent, failed, new_listings: newOnes.length, closing_soon: soon.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denied = await requireAdminOrCron(req);
  if (denied) return denied;

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  try {
    const mode = new URL(req.url).searchParams.get("mode") === "weekly" ? "weekly" : "deadline";
    return json(mode === "weekly" ? await sendWeeklyDigest(db) : await sendDeadlineReminders(db));
  } catch (e) {
    console.error("send-subscription-emails error:", e);
    return json({ error: "Sending failed" }, 500);
  }
});
