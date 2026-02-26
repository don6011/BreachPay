import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { partner_id, email, breach_company, breach_year } = await req.json();

    if (!partner_id || !email || !breach_company) {
      return new Response(JSON.stringify({ error: "partner_id, email, and breach_company are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate partner exists and is active
    const { data: partner, error: partnerErr } = await supabase
      .from("partners")
      .select("id, name, is_active")
      .eq("id", partner_id)
      .single();

    if (partnerErr || !partner?.is_active) {
      return new Response(JSON.stringify({ error: "Invalid or inactive partner" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the intake
    const { data: log, error: logErr } = await supabase
      .from("partner_intake_logs")
      .insert({
        partner_id,
        intake_type: "breach",
        email,
        breach_company,
        breach_year: breach_year || null,
        status: "processing",
      })
      .select("id")
      .single();

    if (logErr) throw logErr;

    // Check if user exists, create if not
    let userId: string;
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const found = existingUser?.users?.find((u) => u.email === email);

    if (found) {
      userId = found.id;
    } else {
      // Create user with random password - they'll reset via email
      const tempPassword = crypto.randomUUID();
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });
      if (createErr || !newUser.user) {
        await supabase.from("partner_intake_logs").update({ status: "failed", meta: { error: createErr?.message } }).eq("id", log.id);
        throw createErr || new Error("Failed to create user");
      }
      userId = newUser.user.id;
    }

    // Create a scan run for the user
    const { data: scanRun, error: scanErr } = await supabase
      .from("scan_runs")
      .insert({
        user_id: userId,
        status: "completed",
        breaches_detected: 1,
        databases_scanned: 1,
        risk_score: 65,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        provider: "partner_intake",
      })
      .select("id")
      .single();

    if (scanErr) throw scanErr;

    // Match against settlements for this breach company
    const { data: matchedSettlements } = await supabase
      .from("settlements")
      .select("id, name")
      .ilike("company", `%${breach_company}%`)
      .eq("status", "active")
      .limit(5);

    // Create settlement matches
    for (const s of matchedSettlements || []) {
      await supabase.from("settlement_matches").insert({
        user_id: userId,
        settlement_id: s.id,
        scan_run_id: scanRun.id,
        confidence_score: 75,
        confidence_level: "high",
        match_reason: `Partner referral from ${partner.name}`,
        status: "new",
      });
    }

    // Create referral tracking
    if (matchedSettlements && matchedSettlements.length > 0) {
      // Track referral for the first matched settlement
      await supabase.from("referrals").insert({
        partner_id,
        claim_id: matchedSettlements[0].id, // placeholder - will be updated when claim is filed
        model: "cpa",
        status: "pending",
      }).catch(() => {}); // Non-critical
    }

    // Update intake log
    await supabase.from("partner_intake_logs").update({
      status: "completed",
      result_user_id: userId,
      result_scan_run_id: scanRun.id,
      processed_at: new Date().toISOString(),
      meta: { matches_found: matchedSettlements?.length || 0 },
    }).eq("id", log.id);

    return new Response(JSON.stringify({
      success: true,
      intake_id: log.id,
      user_id: userId,
      scan_run_id: scanRun.id,
      matches_found: matchedSettlements?.length || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("partner-intake-breach error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
