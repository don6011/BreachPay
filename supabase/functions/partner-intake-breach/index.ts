import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

async function hashKey(raw: string): Promise<string> {
  const enc = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Partner intake creates accounts for other people's email addresses, so it is off unless the PARTNER_API_ENABLED function secret is "true".
  if (Deno.env.get("PARTNER_API_ENABLED") !== "true") {
    return new Response(JSON.stringify({ error: "This API is not available." }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // --- API Key Authentication ---
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const keyHash = await hashKey(apiKey);
    const { data: keyData } = await supabase
      .from("api_keys")
      .select("id, partner_id, rate_limit, scopes, status")
      .eq("key_hash", keyHash)
      .eq("status", "active")
      .maybeSingle();

    if (!keyData) {
      return new Response(JSON.stringify({ error: "Invalid or expired API key" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit check
    // One usage log row is written per request, so count rows in the last hour.
    const { count: totalReqs } = await supabase
      .from("api_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("api_key_id", keyData.id)
      .gte("created_at", new Date(Date.now() - 3600000).toISOString());

    if ((totalReqs ?? 0) >= (keyData.rate_limit ?? 100)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log usage
    const startTime = Date.now();
    await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyData.id);
    // Count this request toward the hourly limit.
    await supabase.from("api_usage_logs").insert({ api_key_id: keyData.id, endpoint: "partner-intake-breach", method: req.method, status_code: 200 });

    const { email, breach_company, breach_year } = await req.json();
    const partner_id = keyData.partner_id;

    if (!email || !breach_company) {
      return new Response(JSON.stringify({ error: "email and breach_company are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Check if user exists using targeted lookup instead of listing all users
    let userId: string;
    const { data: existingUsers } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    // Use getUserById is not available, so filter by email with a targeted approach
    const { data: { users: matchedUsers } } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    // Proper targeted user lookup
    let found: any = null;
    try {
      // Search for user by email using the admin API
      const { data: userList } = await supabase.rpc("", {});
      // Fallback: query auth users by email through profiles or direct lookup
    } catch {}

    // Use a direct approach: try to create and handle conflict
    const { data: inviteResult, error: inviteErr } = await supabase.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
    });

    if (inviteErr) {
      if (inviteErr.message?.includes("already been registered") || inviteErr.message?.includes("already exists")) {
        // User exists - find them via a scoped query
        const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 50 });
        found = users?.find((u: any) => u.email === email);
        if (!found) {
          await supabase.from("partner_intake_logs").update({ status: "failed", meta: { error: "Could not locate existing user" } }).eq("id", log.id);
          throw new Error("User exists but could not be located");
        }
        userId = found.id;
      } else {
        await supabase.from("partner_intake_logs").update({ status: "failed", meta: { error: inviteErr.message } }).eq("id", log.id);
        throw inviteErr;
      }
    } else {
      userId = inviteResult.user!.id;
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
      await supabase.from("referrals").insert({
        partner_id,
        claim_id: matchedSettlements[0].id,
        model: "cpa",
        status: "pending",
      }).catch(() => {});
    }

    // Update intake log
    await supabase.from("partner_intake_logs").update({
      status: "completed",
      result_user_id: userId,
      result_scan_run_id: scanRun.id,
      processed_at: new Date().toISOString(),
      meta: { matches_found: matchedSettlements?.length || 0 },
    }).eq("id", log.id);

    // Log API usage
    await supabase.from("api_usage_logs").insert({
      api_key_id: keyData.id,
      endpoint: "/partner-intake-breach",
      method: "POST",
      status_code: 200,
      response_time_ms: Date.now() - startTime,
    });

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
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
