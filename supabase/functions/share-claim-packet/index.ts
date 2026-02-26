/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatCurrency(n: number | null): string {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildPacketHtml(claim: any, settlement: any, application: any, documents: any[]): string {
  const eligibility = application?.eligibility_answers || {};
  const eligibilityRows = Object.entries(eligibility)
    .map(([k, v]) => `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:500">${esc(k.replace(/_/g, " "))}</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${esc(String(v))}</td></tr>`)
    .join("");

  const docRows = documents
    .map(
      (d) =>
        `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb">${esc(d.file_name)}</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${esc(d.doc_type)}</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${esc(d.status)}</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${formatDate(d.created_at)}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; margin: 40px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 22px; margin-bottom: 4px; color: #0f172a; }
  h2 { font-size: 16px; margin: 28px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #2563eb; color: #2563eb; }
  .meta { color: #64748b; font-size: 11px; margin-bottom: 24px; }
  .shared-banner { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #92400e; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 12px; }
  th { background: #f1f5f9; padding: 8px 12px; border: 1px solid #e5e7eb; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 6px 12px; border: 1px solid #e5e7eb; }
  .grid { display: flex; gap: 16px; margin: 8px 0; }
  .grid-item { flex: 1; background: #f8fafc; border-radius: 8px; padding: 12px; }
  .grid-item .label { font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
  .grid-item .value { font-size: 15px; font-weight: 600; margin-top: 2px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #94a3b8; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-status { background: #dbeafe; color: #1e40af; }
</style></head>
<body>
  <div class="shared-banner">
    ⚠️ This is a shared claim packet. Access expires automatically. Do not share this link further.
  </div>

  <h1>Claim Packet</h1>
  <p class="meta">Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} · Claim ID: ${esc(claim.id?.slice(0, 8))}</p>

  <h2>Settlement Details</h2>
  <table>
    <tr><th>Settlement</th><td>${esc(settlement?.name)}</td></tr>
    <tr><th>Company</th><td>${esc(settlement?.company)}</td></tr>
    <tr><th>Breach Year</th><td>${settlement?.breach_year || "—"}</td></tr>
    <tr><th>Filing Deadline</th><td>${formatDate(settlement?.claim_deadline || settlement?.deadline)}</td></tr>
    <tr><th>Payout Range</th><td>${formatCurrency(settlement?.payout_min)} – ${formatCurrency(settlement?.payout_max)}</td></tr>
    ${settlement?.administrator_name ? `<tr><th>Administrator</th><td>${esc(settlement.administrator_name)}</td></tr>` : ""}
    ${settlement?.case_number ? `<tr><th>Case Number</th><td>${esc(settlement.case_number)}</td></tr>` : ""}
  </table>

  <h2>Claim Status</h2>
  <div class="grid">
    <div class="grid-item"><div class="label">Status</div><div class="value"><span class="badge badge-status">${esc(claim.status?.toUpperCase())}</span></div></div>
    <div class="grid-item"><div class="label">Filed</div><div class="value">${formatDate(claim.filed_at)}</div></div>
    <div class="grid-item"><div class="label">Estimated Payout</div><div class="value">${formatCurrency(claim.est_payout)}</div></div>
  </div>

  <h2>Claimant Information</h2>
  <table>
    <tr><th>Full Name</th><td>${esc(application?.full_name)}</td></tr>
    <tr><th>Email</th><td>${esc(application?.email)}</td></tr>
    <tr><th>Phone</th><td>${esc(application?.phone) || "—"}</td></tr>
    <tr><th>Address</th><td>${esc(application?.address) || "—"}</td></tr>
    <tr><th>Breach Experience</th><td>${esc(application?.breach_experience) || "—"}</td></tr>
  </table>

  ${eligibilityRows ? `
  <h2>Eligibility Answers</h2>
  <table>
    <tr><th>Question</th><th>Answer</th></tr>
    ${eligibilityRows}
  </table>` : ""}

  <h2>Evidence Index (${documents.length} documents)</h2>
  ${documents.length > 0 ? `
  <table>
    <tr><th>File Name</th><th>Category</th><th>Status</th><th>Uploaded</th></tr>
    ${docRows}
  </table>` : "<p>No documents uploaded.</p>"}

  <div class="footer">
    <p>This document is generated by BreachPay for claims administrator / law firm intake review.</p>
    <p>BreachPay is not a law firm and does not provide legal advice.</p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Get token from query string
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up share record
    const { data: share, error: shareErr } = await admin
      .from("claim_packet_shares")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (shareErr || !share) {
      return new Response(JSON.stringify({ error: "Invalid or expired share link" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (new Date(share.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This share link has expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bump access counter
    await admin
      .from("claim_packet_shares")
      .update({
        accessed_count: (share.accessed_count || 0) + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq("id", share.id);

    // Fetch claim data
    const claimId = share.claim_id;

    const [claimRes, settlementRes, appRes, docsRes] = await Promise.all([
      admin.from("claims").select("*").eq("id", claimId).maybeSingle(),
      admin.from("claims").select("settlement_id").eq("id", claimId).maybeSingle().then(async (r) => {
        if (!r.data?.settlement_id) return { data: null };
        return admin.from("settlements").select("*").eq("id", r.data.settlement_id).maybeSingle();
      }),
      admin.from("claim_applications").select("*").eq("claim_id", claimId).maybeSingle(),
      admin.from("claim_documents").select("*").eq("claim_id", claimId).order("created_at", { ascending: true }),
    ]);

    const html = buildPacketHtml(claimRes.data, settlementRes.data, appRes.data, docsRes.data || []);

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
