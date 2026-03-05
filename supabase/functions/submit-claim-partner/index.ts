/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Fetch claim with settlement
    const { data: claim } = await admin
      .from("claims")
      .select("*, settlements(submission_mode, name, company)")
      .eq("id", claim_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!claim) {
      return new Response(JSON.stringify({ ok: false, error: "claim_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (claim.settlements?.submission_mode !== "partner_api") {
      return new Response(JSON.stringify({ ok: false, error: "settlement_not_partner_api" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simulate partner API submission
    // In production, this would call the partner's actual API endpoint
    const externalRef = `BP-${claim_id.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;

    // Update claim
    await admin.from("claims").update({
      status: "submitted",
      submission_channel: "partner_api",
      submitted_to_admin_at: new Date().toISOString(),
      external_submission_ref: externalRef,
      updated_at: new Date().toISOString(),
    }).eq("id", claim_id);

    // Log status history
    await admin.from("claim_status_history").insert({
      claim_id,
      status: "submitted",
      note: `Submitted to settlement administrator via partner API. Ref: ${externalRef}`,
      updated_by: "system",
    });

    return new Response(JSON.stringify({
      ok: true,
      external_ref: externalRef,
      submitted_at: new Date().toISOString(),
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
