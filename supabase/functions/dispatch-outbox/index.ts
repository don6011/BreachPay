/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_ATTEMPTS = 8;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Missing env" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

  try {
    // Use SKIP LOCKED claim function for safe concurrent dispatch
    const { data: rows, error: claimErr } = await supabase.rpc("proc_claim_outbox", {
      batch_size: 50,
    });

    if (claimErr) throw claimErr;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of rows) {
      const channel = row.channel;

      // Fetch user email if needed
      let email: string | null = null;
      if (channel === "email") {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("email")
          .eq("user_id", row.user_id)
          .single();
        email = profile?.email || null;
      }

      try {
        if (channel === "in_app") {
          // In-app notifications are handled via alerts table — just mark sent
          await supabase
            .from("notification_outbox")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", row.id);
          sent++;
        } else if (channel === "email" && resend && email) {
          const subject = buildSubject(row.template, row.payload);
          const html = buildHtml(row.template, row.payload);

          const emailRes = await resend.emails.send({
            from: "BreachPay <noreply@breachpay.com>",
            to: [email],
            subject,
            html,
          });

          if (emailRes.error) throw new Error(emailRes.error.message);

          await supabase
            .from("notification_outbox")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", row.id);
          sent++;
        } else {
          // Channel not supported or missing config — revert to pending or fail
          const errorMsg = channel === "email" && !resend
            ? "RESEND_API_KEY not configured"
            : channel === "email" && !email
              ? "User has no email"
              : `Unsupported channel: ${channel}`;

          await supabase
            .from("notification_outbox")
            .update({
              status: row.attempts >= MAX_ATTEMPTS ? "failed" : "pending",
              last_error: errorMsg,
            })
            .eq("id", row.id);
          skipped++;
        }
      } catch (sendErr: any) {
        const errorMsg = sendErr?.message || String(sendErr);
        const newStatus = row.attempts >= MAX_ATTEMPTS ? "failed" : "pending";
        await supabase
          .from("notification_outbox")
          .update({ status: newStatus, last_error: errorMsg })
          .eq("id", row.id);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, processed: rows.length, sent, failed, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- Template helpers ---

function buildSubject(template: string, payload: any): string {
  switch (template) {
    case "new_match":
      return `New Settlement Match: ${payload?.company || "Unknown"}`;
    case "deadline_soon":
      return `⚠️ Claim Deadline: ${payload?.days_left || "?"} days left`;
    case "scan_complete":
      return `Scan Complete — ${payload?.breaches || 0} exposures found`;
    default:
      return "BreachPay Notification";
  }
}

function buildHtml(template: string, payload: any): string {
  switch (template) {
    case "new_match":
      return `
        <h2>New Settlement Match Found</h2>
        <p>You may qualify for <strong>${payload?.settlement_name || "a settlement"}</strong> from ${payload?.company || "a company"}.</p>
        ${payload?.payout_estimate ? `<p>Estimated payout: <strong>$${Number(payload.payout_estimate).toFixed(2)}</strong></p>` : ""}
        <p><a href="https://breachpay.com/settlements">View your matches →</a></p>
      `;
    case "deadline_soon":
      return `
        <h2>⚠️ Claim Deadline Approaching</h2>
        <p><strong>${payload?.settlement_name || "A settlement"}</strong> has only <strong>${payload?.days_left} day(s)</strong> left to file.</p>
        <p><a href="https://breachpay.com/claims">File your claim now →</a></p>
      `;
    case "scan_complete":
      return `
        <h2>Scan Complete</h2>
        <p>We scanned 12,000+ databases and found <strong>${payload?.breaches || 0}</strong> breach exposure(s).</p>
        <p>Your risk score: <strong>${payload?.score || 0}/100</strong></p>
        <p><a href="https://breachpay.com/dashboard">View your dashboard →</a></p>
      `;
    default:
      return `<p>You have a new notification from BreachPay. <a href="https://breachpay.com/dashboard">View details →</a></p>`;
  }
}
