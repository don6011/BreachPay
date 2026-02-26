/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type OutboxRow = {
  id: string;
  user_id: string;
  channel: "email" | "sms" | "push" | "in_app";
  template: "new_match" | "deadline_soon" | "scan_complete";
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

function buildEmailHtml(
  template: OutboxRow["template"],
  payload: Record<string, unknown>,
  appBaseUrl: string
) {
  const settlementId = String(payload.settlement_id ?? "");
  const settlementName = String(payload.settlement_name ?? "Settlement");
  const company = String(payload.company ?? "");
  const payout = payload.payout_estimate ?? payload.payout_est ?? "";
  const daysLeft = payload.days_left ?? "";

  const detailsUrl = settlementId
    ? `${appBaseUrl.replace(/\/$/, "")}/settlements/${encodeURIComponent(settlementId)}`
    : `${appBaseUrl.replace(/\/$/, "")}/settlements`;

  const footer = buildUnsubscribeFooter(appBaseUrl);

  if (template === "new_match") {
    const subject = `New settlement match: ${settlementName}`;
    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px">
        <h2>New settlement match found</h2>
        <p><strong>${settlementName}</strong>${company ? ` — ${company}` : ""}</p>
        ${payout ? `<p>Estimated payout: <strong>$${Number(payout).toFixed(2)}</strong></p>` : ""}
        <p><a href="${detailsUrl}" style="color:#2563eb">View details →</a></p>
        ${footer}
      </div>
    `;
    return { subject, html };
  }

  if (template === "deadline_soon") {
    const subject = `Claim deadline approaching: ${settlementName}`;
    const html = `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px">
        <h2>⚠️ Deadline approaching</h2>
        <p><strong>${settlementName}</strong>${company ? ` — ${company}` : ""}</p>
        ${daysLeft !== "" ? `<p>Days left: <strong>${String(daysLeft)}</strong></p>` : ""}
        <p><a href="${detailsUrl}" style="color:#2563eb">Review claim →</a></p>
        ${footer}
      </div>
    `;
    return { subject, html };
  }

  // scan_complete
  const subject = `Your BreachPay scan is complete`;
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px">
      <h2>Scan complete</h2>
      <p>Your scheduled scan finished successfully.</p>
      ${payload.breaches ? `<p>Exposures found: <strong>${payload.breaches}</strong></p>` : ""}
      ${payload.score ? `<p>Risk score: <strong>${payload.score}/100</strong></p>` : ""}
      <p><a href="${appBaseUrl.replace(/\/$/, "")}/dashboard" style="color:#2563eb">Open dashboard →</a></p>
      ${footer}
    </div>
  `;
  return { subject, html };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
        await supabase
          .from("notification_outbox")
          .update({ status: "failed", last_error: msg })
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
