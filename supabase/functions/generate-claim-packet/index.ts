/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "https://esm.sh/jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function money(n: number | null): string {
  if (n == null) return "—";
  return `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safe(s: string | null | undefined): string {
  return s || "—";
}

function buildPdf(claim: any, settlement: any, application: any, documents: any[], match: any): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pw - margin * 2;
  let y = margin;

  const blue = [37, 99, 235];
  const dark = [15, 23, 42];
  const gray = [100, 116, 139];

  function heading(text: string) {
    y += 6;
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.5);
    doc.line(margin, y + 5, pw - margin, y + 5);
    doc.setFontSize(13);
    doc.setTextColor(...blue);
    doc.setFont("helvetica", "bold");
    doc.text(text, margin, y + 3);
    y += 10;
  }

  function row(label: string, value: string) {
    if (y > 270) { doc.addPage(); y = margin; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(value, contentW - 50);
    doc.text(lines, margin + 50, y);
    y += Math.max(5, lines.length * 4.5);
  }

  function checkPage(needed: number) {
    if (y + needed > 275) { doc.addPage(); y = margin; }
  }

  // HEADER
  doc.setFontSize(20);
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold");
  doc.text("BreachPay Claim Packet", margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(...gray);
  doc.setFont("helvetica", "normal");
  doc.text("Compensation Recovery File", margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC  •  Claim ID: ${(claim.id || "").slice(0, 8)}`, margin, y);
  y += 4;

  // Verified badge
  if (settlement?.credibility_score) {
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(margin, y, 40, 5, 1, 1, "F");
    doc.setFontSize(7);
    doc.setTextColor(22, 101, 52);
    doc.text(`✓ Verified  •  Credibility: ${settlement.credibility_score}/100`, margin + 2, y + 3.5);
    y += 8;
  } else {
    y += 3;
  }

  // PAGE 1: Settlement Details
  heading("Settlement Details");
  row("Settlement", safe(settlement?.name));
  row("Company", safe(settlement?.company));
  row("Breach Year", settlement?.breach_year ? String(settlement.breach_year) : "—");
  row("Filing Deadline", fmt(settlement?.claim_deadline || settlement?.deadline));
  row("Payout Range", `${money(settlement?.payout_min)} – ${money(settlement?.payout_max)}`);
  row("Verification", safe(settlement?.verification_level || "verified"));
  if (settlement?.administrator_name) row("Administrator", settlement.administrator_name);
  if (settlement?.case_number) row("Case Number", settlement.case_number);
  if (settlement?.jurisdiction) row("Jurisdiction", settlement.jurisdiction);

  // Claim Status
  heading("Claim Status");
  row("Status", (claim.status || "draft").toUpperCase());
  row("Filed", fmt(claim.filed_at));
  row("Estimated Payout", money(claim.est_payout));
  row("Platform Fee", `${claim.fee_percent || 15}%`);

  // Match Confidence
  if (match) {
    heading("Match Confidence");
    row("Score", `${match.confidence_score || "—"}%`);
    row("Level", safe(match.confidence_level));
    row("Reason", safe(match.match_reason));
  }

  // Claimant Information
  heading("Claimant Information");
  row("Full Name", safe(application?.full_name));
  row("Email", safe(application?.email));
  row("Phone", safe(application?.phone));
  row("Address", safe(application?.address));
  row("Breach Experience", safe(application?.breach_experience));
  row("Certs Signed", application?.certifications_signed ? "Yes" : "No");

  // Eligibility Answers
  const eligibility = application?.eligibility_answers || {};
  const entries = Object.entries(eligibility);
  if (entries.length > 0) {
    heading("Eligibility Answers");
    for (const [k, v] of entries) {
      row(k.replace(/_/g, " "), String(v));
    }
  }

  // PAGE 2: Evidence Index
  doc.addPage();
  y = margin;
  heading(`Evidence Index (${documents.length} documents)`);

  if (documents.length > 0) {
    // Table header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentW, 6, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    const cols = [margin + 2, margin + 55, margin + 85, margin + 110, margin + 135];
    doc.text("FILE NAME", cols[0], y + 4);
    doc.text("CATEGORY", cols[1], y + 4);
    doc.text("STATUS", cols[2], y + 4);
    doc.text("SIZE", cols[3], y + 4);
    doc.text("UPLOADED", cols[4], y + 4);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    for (const d of documents) {
      checkPage(6);
      doc.setTextColor(60, 60, 60);
      doc.text((d.file_name || "").slice(0, 30), cols[0], y + 3);
      doc.text(safe(d.doc_type).slice(0, 16), cols[1], y + 3);
      doc.text(safe(d.status), cols[2], y + 3);
      doc.text(d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : "—", cols[3], y + 3);
      doc.text(fmt(d.created_at).slice(0, 18), cols[4], y + 3);
      doc.setDrawColor(229, 231, 235);
      doc.line(margin, y + 5, pw - margin, y + 5);
      y += 6;
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text("No documents uploaded.", margin, y + 4);
    y += 8;
  }

  // PAGE 3: Declaration
  doc.addPage();
  y = margin;
  heading("Claimant Declaration");

  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "normal");

  const decl1 = doc.splitTextToSize(
    `I, ${application?.full_name || "________________________"}, hereby declare that the information provided in this claim packet is true and accurate to the best of my knowledge. I understand that submitting false or misleading information may result in the denial of my claim and potential legal consequences.`,
    contentW
  );
  doc.text(decl1, margin, y);
  y += decl1.length * 5 + 4;

  const decl2 = doc.splitTextToSize(
    `I confirm that I was affected by the ${settlement?.company || ""} data breach${settlement?.breach_year ? ` (${settlement.breach_year})` : ""} and that I am eligible to participate in the ${settlement?.name || ""} settlement as described herein.`,
    contentW
  );
  doc.text(decl2, margin, y);
  y += decl2.length * 5 + 4;

  const decl3 = doc.splitTextToSize(
    `I authorize BreachPay to act on my behalf in processing this claim and understand that a platform fee of ${claim.fee_percent || 15}% will apply to any awarded compensation.`,
    contentW
  );
  doc.text(decl3, margin, y);
  y += decl3.length * 5 + 12;

  // Signature lines
  checkPage(30);
  doc.setDrawColor(...dark);
  doc.line(margin, y + 10, margin + 70, y + 10);
  doc.line(margin + 85, y + 10, pw - margin, y + 10);
  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("Signature", margin, y + 15);
  doc.text("Date", margin + 85, y + 15);
  y += 22;

  // Certification note
  doc.setFontSize(7);
  if (application?.certifications_signed) {
    doc.text("✓ Digital certifications were signed at submission.", margin, y);
  } else {
    doc.text("⚠ Digital certifications were not signed.", margin, y);
  }
  if (application?.disclaimer_accepted_at) {
    doc.text(`Disclaimer accepted on ${fmt(application.disclaimer_accepted_at)}.`, margin, y + 4);
  }

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...gray);
    doc.text("Generated by BreachPay Settlement Recovery Platform", margin, 288);
    doc.text("BreachPay is not a law firm and does not provide legal advice.", margin, 291);
    doc.text(`Page ${i} of ${totalPages}`, pw - margin - 20, 291);
  }

  return new Uint8Array(doc.output("arraybuffer"));
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

    const { data: isAdminData } = await admin.rpc("is_admin", { p_user: userId });
    if (claim.user_id !== userId && !isAdminData) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [settlementRes, appRes, docsRes, matchRes] = await Promise.all([
      admin.from("settlements").select("*").eq("id", claim.settlement_id).maybeSingle(),
      admin.from("claim_applications").select("*").eq("claim_id", claim_id).maybeSingle(),
      admin.from("claim_documents").select("*").eq("claim_id", claim_id).order("created_at", { ascending: true }),
      claim.match_id
        ? admin.from("settlement_matches").select("confidence_score, confidence_level, match_reason").eq("id", claim.match_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // Generate real PDF
    const pdfBytes = buildPdf(claim, settlementRes.data, appRes.data, docsRes.data || [], matchRes.data);

    const friendlyName = `BreachPay-Claim-Packet-${claim_id.slice(0, 8)}.pdf`;

    // Insert claim_packets row
    const { data: packet, error: packetInsertErr } = await admin
      .from("claim_packets")
      .insert({
        claim_id,
        generated_by: userId,
        status: "generated",
        pdf_file_name: friendlyName,
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

    // Upload real PDF binary
    const { error: uploadErr } = await admin.storage
      .from(bucket)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
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
    }).eq("id", packetId);

    // Update claims.packet_generated_at
    await admin.from("claims").update({
      packet_generated_at: new Date().toISOString(),
    }).eq("id", claim_id);

    return new Response(JSON.stringify({
      ok: true,
      packet_id: packetId,
      storage_path: storagePath,
      file_name: friendlyName,
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
