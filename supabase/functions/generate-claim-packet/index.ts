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

function buildPacketHtml(claim: any, settlement: any, application: any, documents: any[], match: any): string {
  const eligibility = application?.eligibility_answers || {};
  const eligibilityRows = Object.entries(eligibility)
    .map(([k, v]) => `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb;font-weight:500">${esc(k.replace(/_/g, " "))}</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${esc(String(v))}</td></tr>`)
    .join("");

  const docRows = documents
    .map(
      (d: any) =>
        `<tr><td style="padding:6px 12px;border:1px solid #e5e7eb">${esc(d.file_name)}</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${esc(d.doc_type)}</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${esc(d.status)}</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${d.file_size ? (d.file_size / 1024).toFixed(1) + " KB" : "—"}</td><td style="padding:6px 12px;border:1px solid #e5e7eb">${formatDate(d.created_at)}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; margin: 40px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 22px; margin-bottom: 4px; color: #0f172a; }
  h2 { font-size: 16px; margin: 28px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #2563eb; color: #2563eb; }
  .meta { color: #64748b; font-size: 11px; margin-bottom: 24px; }
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
  @media print { body { margin: 20px; } }
</style></head>
<body>
  <h1>Claim Packet</h1>
  <p class="meta">Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · Claim ID: ${esc(claim.id?.slice(0, 8))}</p>

  <h2>Settlement Details</h2>
  <table>
    <tr><th>Settlement</th><td>${esc(settlement?.name)}</td></tr>
    <tr><th>Company</th><td>${esc(settlement?.company)}</td></tr>
    <tr><th>Breach Year</th><td>${settlement?.breach_year || "—"}</td></tr>
    <tr><th>Filing Deadline</th><td>${formatDate(settlement?.claim_deadline || settlement?.deadline)}</td></tr>
    <tr><th>Payout Range</th><td>${formatCurrency(settlement?.payout_min)} – ${formatCurrency(settlement?.payout_max)}</td></tr>
    ${settlement?.administrator_name ? `<tr><th>Administrator</th><td>${esc(settlement.administrator_name)}</td></tr>` : ""}
    ${settlement?.case_number ? `<tr><th>Case Number</th><td>${esc(settlement.case_number)}</td></tr>` : ""}
    ${settlement?.jurisdiction ? `<tr><th>Jurisdiction</th><td>${esc(settlement.jurisdiction)}</td></tr>` : ""}
  </table>

  <h2>Claim Status</h2>
  <div class="grid">
    <div class="grid-item"><div class="label">Status</div><div class="value"><span class="badge badge-status">${esc(claim.status?.toUpperCase())}</span></div></div>
    <div class="grid-item"><div class="label">Filed</div><div class="value">${formatDate(claim.filed_at)}</div></div>
    <div class="grid-item"><div class="label">Estimated Payout</div><div class="value">${formatCurrency(claim.est_payout)}</div></div>
    <div class="grid-item"><div class="label">Platform Fee</div><div class="value">${claim.fee_percent || 15}%</div></div>
  </div>

  ${match ? `
  <h2>Match Confidence</h2>
  <table>
    <tr><th>Confidence Score</th><td>${match.confidence_score || "—"}%</td></tr>
    <tr><th>Confidence Level</th><td>${esc(match.confidence_level)}</td></tr>
    <tr><th>Match Reason</th><td>${esc(match.match_reason)}</td></tr>
  </table>` : ""}

  <h2>Claimant Information</h2>
  <table>
    <tr><th>Full Name</th><td>${esc(application?.full_name)}</td></tr>
    <tr><th>Email</th><td>${esc(application?.email)}</td></tr>
    <tr><th>Phone</th><td>${esc(application?.phone) || "—"}</td></tr>
    <tr><th>Address</th><td>${esc(application?.address) || "—"}</td></tr>
    <tr><th>Breach Experience</th><td>${esc(application?.breach_experience) || "—"}</td></tr>
    <tr><th>Certifications Signed</th><td>${application?.certifications_signed ? "Yes" : "No"}</td></tr>
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
    <tr><th>File Name</th><th>Category</th><th>Status</th><th>Size</th><th>Uploaded</th></tr>
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

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await supabaseUser.auth.getClaims(token);
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const { claim_id } = await req.json();
    if (!claim_id) throw new Error("Missing claim_id");

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch claim (verify ownership or admin)
    const { data: claim, error: claimErr } = await admin
      .from("claims")
      .select("*")
      .eq("id", claim_id)
      .maybeSingle();

    if (claimErr || !claim) throw new Error("Claim not found");

    // Verify access: owner or admin
    const { data: isAdminData } = await admin.rpc("is_admin", { p_user: userId });
    if (claim.user_id !== userId && !isAdminData) throw new Error("Access denied");

    // Fetch settlement, application, documents, match in parallel
    const [settlementRes, appRes, docsRes, matchRes] = await Promise.all([
      admin.from("settlements").select("*").eq("id", claim.settlement_id).maybeSingle(),
      admin.from("claim_applications").select("*").eq("claim_id", claim_id).maybeSingle(),
      admin.from("claim_documents").select("*").eq("claim_id", claim_id).order("created_at", { ascending: true }),
      claim.match_id
        ? admin.from("settlement_matches").select("confidence_score, confidence_level, match_reason").eq("id", claim.match_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const html = buildPacketHtml(claim, settlementRes.data, appRes.data, docsRes.data || [], matchRes.data);

    // Store HTML as file in claim-packets bucket
    const fileName = `claim-packet-${claim_id.slice(0, 8)}-${Date.now()}.html`;
    const storagePath = `${userId}/${fileName}`;

    const { error: uploadErr } = await admin.storage
      .from("claim-packets")
      .upload(storagePath, new TextEncoder().encode(html), {
        contentType: "text/html",
        upsert: false,
      });

    // Insert claim_packets row
    const docCount = docsRes.data?.length || 0;
    const packetStatus = uploadErr ? "failed" : "generated";

    await admin.from("claim_packets").insert({
      claim_id,
      status: packetStatus,
      pdf_storage_path: uploadErr ? null : storagePath,
      pdf_file_name: uploadErr ? null : fileName,
      generated_by: userId,
      meta: {
        settlement_name: settlementRes.data?.name,
        company: settlementRes.data?.company,
        document_count: docCount,
        has_application: !!appRes.data,
        has_match: !!matchRes.data,
      },
      last_error: uploadErr?.message || null,
    });

    // Return the HTML for immediate viewing
    return new Response(JSON.stringify({
      success: true,
      packet_file: fileName,
      storage_path: storagePath,
      document_count: docCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
