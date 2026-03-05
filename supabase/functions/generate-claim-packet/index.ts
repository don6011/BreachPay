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
  .page-break { page-break-before: always; margin-top: 40px; }
  @media print { body { margin: 20px; } }
</style></head>
<body>
  <!-- PAGE 1: Settlement & Claimant Info -->
  <h1>BreachPay Claim Packet</h1>
  <p style="font-size:13px;color:#64748b;margin:-4px 0 4px">Compensation Recovery File</p>
  <p style="font-size:11px;margin:0 0 20px"><span class="badge" style="background:#dcfce7;color:#166534">✓ Verified Settlement</span>${settlement?.credibility_score ? ` <span class="badge" style="background:#f0fdf4;color:#166534">Credibility: ${settlement.credibility_score}/100</span>` : ""}</p>
  <p class="meta">Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · Claim ID: ${esc(claim.id?.slice(0, 8))}</p>

  <h2>Settlement Details</h2>
  <table>
    <tr><th>Settlement</th><td>${esc(settlement?.name)}</td></tr>
    <tr><th>Company</th><td>${esc(settlement?.company)}</td></tr>
    <tr><th>Breach Year</th><td>${settlement?.breach_year || "—"}</td></tr>
    <tr><th>Filing Deadline</th><td>${formatDate(settlement?.claim_deadline || settlement?.deadline)}</td></tr>
    <tr><th>Payout Range</th><td>${formatCurrency(settlement?.payout_min)} – ${formatCurrency(settlement?.payout_max)}</td></tr>
    <tr><th>Verification</th><td>${esc(settlement?.verification_level || "verified")} · ${esc(settlement?.verification_status || "verified")}</td></tr>
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

  <!-- PAGE 2: Supporting Evidence -->
  <div class="page-break">
  <h2>Evidence Index (${documents.length} documents)</h2>
  ${documents.length > 0 ? `
  <table>
    <tr><th>File Name</th><th>Category</th><th>Status</th><th>Size</th><th>Uploaded</th></tr>
    ${docRows}
  </table>` : "<p>No documents uploaded.</p>"}
  </div>

  <!-- PAGE 3: Claimant Declaration -->
  <div class="page-break">
  <h2>Claimant Declaration</h2>
  <div style="border: 2px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 16px 0;">
    <p style="font-size: 13px; line-height: 1.8;">
      I, <strong>${esc(application?.full_name) || "________________________"}</strong>, hereby declare that the information provided in this claim packet is true and accurate to the best of my knowledge. I understand that submitting false or misleading information may result in the denial of my claim and potential legal consequences.
    </p>
    <p style="font-size: 13px; line-height: 1.8; margin-top: 12px;">
      I confirm that I was affected by the <strong>${esc(settlement?.company)}</strong> data breach${settlement?.breach_year ? ` (${settlement.breach_year})` : ""} and that I am eligible to participate in the <strong>${esc(settlement?.name)}</strong> settlement as described herein.
    </p>
    <p style="font-size: 13px; line-height: 1.8; margin-top: 12px;">
      I authorize BreachPay to act on my behalf in processing this claim and understand that a platform fee of <strong>${claim.fee_percent || 15}%</strong> will apply to any awarded compensation.
    </p>
    <div style="margin-top: 40px; display: flex; gap: 48px;">
      <div style="flex: 1;">
        <div style="border-bottom: 1px solid #1a1a2e; height: 40px;"></div>
        <p style="font-size: 11px; color: #64748b; margin-top: 4px;">Signature</p>
      </div>
      <div style="flex: 1;">
        <div style="border-bottom: 1px solid #1a1a2e; height: 40px;"></div>
        <p style="font-size: 11px; color: #64748b; margin-top: 4px;">Date</p>
      </div>
    </div>
    <p style="font-size: 11px; color: #94a3b8; margin-top: 16px;">
      ${application?.certifications_signed ? "✓ Digital certifications were signed at submission." : "⚠ Digital certifications were not signed."}
      ${application?.disclaimer_accepted_at ? ` Disclaimer accepted on ${formatDate(application.disclaimer_accepted_at)}.` : ""}
    </p>
  </div>
  </div>

  <div class="footer">
    <p>Generated by BreachPay Settlement Recovery Platform</p>
    <p>BreachPay is not a law firm and does not provide legal advice. Eligibility depends on settlement administrator review.</p>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bucket = Deno.env.get("PACKET_BUCKET") ?? "claim-packets";

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await supabaseUser.auth.getClaims(token);
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { claim_id } = await req.json();
    if (!claim_id) {
      return new Response(JSON.stringify({ ok: false, error: "missing_claim_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch claim
    const { data: claim, error: claimErr } = await admin
      .from("claims")
      .select("*")
      .eq("id", claim_id)
      .maybeSingle();

    if (claimErr || !claim) {
      return new Response(JSON.stringify({ ok: false, error: "claim_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: owner or admin
    const { data: isAdminData } = await admin.rpc("is_admin", { p_user: userId });
    if (claim.user_id !== userId && !isAdminData) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch related data in parallel
    const [settlementRes, appRes, docsRes, matchRes] = await Promise.all([
      admin.from("settlements").select("*").eq("id", claim.settlement_id).maybeSingle(),
      admin.from("claim_applications").select("*").eq("claim_id", claim_id).maybeSingle(),
      admin.from("claim_documents").select("*").eq("claim_id", claim_id).order("created_at", { ascending: true }),
      claim.match_id
        ? admin.from("settlement_matches").select("confidence_score, confidence_level, match_reason").eq("id", claim.match_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const html = buildPacketHtml(claim, settlementRes.data, appRes.data, docsRes.data || [], matchRes.data);

    // Create claim_packets row first to get packet_id
    const { data: packet, error: packetInsertErr } = await admin
      .from("claim_packets")
      .insert({
        claim_id,
        generated_by: userId,
        status: "generated",
        meta: {
          settlement_name: settlementRes.data?.name,
          company: settlementRes.data?.company,
          document_count: docsRes.data?.length || 0,
          has_application: !!appRes.data,
          has_match: !!matchRes.data,
        },
      })
      .select("id")
      .single();

    if (packetInsertErr || !packet) {
      throw new Error(`packet_insert_failed: ${packetInsertErr?.message ?? "unknown"}`);
    }

    const packetId = packet.id as string;
    const storagePath = `${claim_id}/${packetId}.pdf`;

    // Upload HTML as PDF placeholder (content is HTML, saved as .pdf for now)
    const { error: uploadErr } = await admin.storage
      .from(bucket)
      .upload(storagePath, new TextEncoder().encode(html), {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadErr) {
      await admin.from("claim_packets").update({
        status: "failed",
        last_error: uploadErr.message,
      }).eq("id", packetId);
      throw new Error(`upload_failed: ${uploadErr.message}`);
    }

    // Update packet with storage path
    await admin.from("claim_packets").update({
      pdf_storage_path: storagePath,
      pdf_file_name: `claim-packet-${claim_id.slice(0, 8)}.pdf`,
    }).eq("id", packetId);

    // Update claims.packet_generated_at
    await admin.from("claims").update({
      packet_generated_at: new Date().toISOString(),
    }).eq("id", claim_id);

    return new Response(JSON.stringify({
      ok: true,
      packet_id: packetId,
      pdf_storage_path: `${bucket}/${storagePath}`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
