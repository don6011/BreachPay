import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface HibpBreach {
  Name: string;
  Title: string;
  Domain: string;
  BreachDate: string;
  AddedDate: string;
  ModifiedDate: string;
  PwnCount: number;
  Description: string;
  DataClasses: string[];
  IsVerified: boolean;
  IsSensitive: boolean;
  IsRetired: boolean;
  IsSpamList: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const HIBP_KEY = Deno.env.get("HIBP_API_KEY")!;

  if (!HIBP_KEY) {
    return new Response(JSON.stringify({ error: "HIBP_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Authenticate the calling user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub;
  const userEmail = claimsData.claims.email;

  if (!userEmail) {
    return new Response(JSON.stringify({ error: "User email not available" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Create scan run
    const { data: scanRun, error: scanErr } = await supabase
      .from("scan_runs")
      .insert({
        user_id: userId,
        status: "running",
        started_at: new Date().toISOString(),
        provider: "hibp",
        databases_scanned: 1,
      })
      .select("id")
      .single();

    if (scanErr) throw scanErr;
    const scanRunId = scanRun.id;

    // Call HIBP API
    const hibpRes = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(userEmail)}?truncateResponse=false`,
      {
        headers: {
          "hibp-api-key": HIBP_KEY,
          "user-agent": "BreachPay-ClaimPlatform/1.0",
        },
      }
    );

    let hibpBreaches: HibpBreach[] = [];

    if (hibpRes.status === 404) {
      // No breaches found — clean result
      hibpBreaches = [];
    } else if (hibpRes.status === 200) {
      hibpBreaches = await hibpRes.json();
    } else if (hibpRes.status === 429) {
      // Rate limited — complete with error note
      await supabase.from("scan_runs").update({
        status: "failed",
        error_message: "HIBP rate limit hit. Please try again in a moment.",
        completed_at: new Date().toISOString(),
      }).eq("id", scanRunId);

      return new Response(JSON.stringify({ error: "Rate limited by HIBP. Please wait and try again." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errText = await hibpRes.text();
      throw new Error(`HIBP API error ${hibpRes.status}: ${errText}`);
    }

    // Process each breach
    let riskScore = 0;
    let breachesInserted = 0;
    const matchedSettlementIds: string[] = [];

    for (const breach of hibpBreaches) {
      // Map HIBP data classes to exposed_fields format
      const exposedFields = breach.DataClasses.join(", ");
      const breachYear = breach.BreachDate
        ? parseInt(breach.BreachDate.substring(0, 4))
        : null;

      // Calculate risk contribution
      const hasSsn = breach.DataClasses.some(d =>
        d.toLowerCase().includes("social security") || d.toLowerCase().includes("ssn")
      );
      const hasFinancial = breach.DataClasses.some(d =>
        d.toLowerCase().includes("credit card") ||
        d.toLowerCase().includes("bank account") ||
        d.toLowerCase().includes("financial")
      );
      const hasPassword = breach.DataClasses.some(d =>
        d.toLowerCase().includes("password")
      );

      let sev = "low";
      if (hasSsn || hasFinancial) sev = "critical";
      else if (hasPassword || breach.PwnCount > 5_000_000) sev = "high";
      else if (breach.PwnCount > 500_000) sev = "medium";

      riskScore += sev === "critical" ? 22 : sev === "high" ? 16 : sev === "medium" ? 9 : 5;
      if (hasPassword) riskScore += 10;
      if (hasSsn) riskScore += 20;
      if (hasFinancial) riskScore += 12;

      // Upsert into breach_catalog
      const { data: catalogEntry } = await supabase
        .from("breach_catalog")
        .upsert({
          name: breach.Title,
          company: breach.Title,
          source_type: "hibp",
          source_name: "Have I Been Pwned",
          source_url: `https://haveibeenpwned.com/api/v3/breach/${breach.Name}`,
          breach_year: breachYear,
          records_exposed: breach.PwnCount,
          exposed_fields: exposedFields,
          data_types: breach.DataClasses,
          severity: sev,
          verified: breach.IsVerified,
          active: !breach.IsRetired,
          verification_status: breach.IsVerified ? "verified" : "pending",
        }, {
          onConflict: "name",
          ignoreDuplicates: false,
        })
        .select("id")
        .maybeSingle();

      // Insert breach event for this user
      const { error: evtErr } = await supabase
        .from("breach_events")
        .insert({
          user_id: userId,
          scan_run_id: scanRunId,
          breach_catalog_id: catalogEntry?.id ?? null,
          source: breach.Title,
          breach_year: breachYear,
          risk_level: sev as "low" | "medium" | "high" | "critical",
          exposed_fields: breach.DataClasses,
          details: {
            hibp: true,
            domain: breach.Domain,
            pwn_count: breach.PwnCount,
            is_verified: breach.IsVerified,
            is_sensitive: breach.IsSensitive,
            data_classes: breach.DataClasses,
            breach_date: breach.BreachDate,
          },
        });

      if (!evtErr) breachesInserted++;

      // Insert alert
      await supabase.from("alerts").insert({
        user_id: userId,
        type: "breach_detected",
        title: `Your data was found in the ${breach.Title} breach`,
        body: `${breach.Title} exposed: ${exposedFields}${breachYear ? ` (${breachYear})` : ""}. ${breach.PwnCount.toLocaleString()} accounts affected.`,
        severity: sev as "low" | "medium" | "high" | "critical",
        related_scan_run_id: scanRunId,
      });

      // Match against settlements
      const { data: settlements } = await supabase
        .from("settlements")
        .select("id, name, company, breach_year, payout_min, payout_max, status")
        .or(`company.ilike.%${breach.Title}%,company.ilike.%${breach.Domain.replace(/\.[^.]+$/, "")}%`)
        .in("status", ["verified", "open"]);

      for (const s of settlements ?? []) {
        const yearMatch = !s.breach_year || !breachYear || s.breach_year === breachYear;
        const confidence = yearMatch ? 85 : 65;
        const confLevel = confidence >= 85 ? "strong" : "medium";
        const payoutEst = s.payout_min && s.payout_max
          ? (s.payout_min + s.payout_max) / 2
          : null;

        await supabase.from("settlement_matches").upsert({
          user_id: userId,
          settlement_id: s.id,
          scan_run_id: scanRunId,
          confidence_score: confidence,
          confidence_level: confLevel,
          match_reason: `HIBP breach match: ${breach.Title}${yearMatch && breachYear ? ` (${breachYear})` : ""}`,
          status: s.status,
          payout_estimate: payoutEst,
        }, { onConflict: "user_id,settlement_id" });

        matchedSettlementIds.push(s.id);

        // Notify
        await supabase.from("notification_outbox").insert({
          user_id: userId,
          channel: "in_app",
          template: "new_match",
          payload: {
            settlement_id: s.id,
            settlement_name: s.name,
            company: s.company,
            payout_estimate: payoutEst,
            confidence: confLevel,
            confidence_score: confidence,
          },
          dedupe_key: `new_match:${userId}:${s.id}`,
        }).select().single().then(() => {}).catch(() => {});
      }
    }

    if (riskScore > 100) riskScore = 100;

    // Update scan run
    await supabase.from("scan_runs").update({
      status: "completed",
      breaches_detected: breachesInserted,
      risk_score: riskScore,
      eligible_settlements: matchedSettlementIds.length,
      completed_at: new Date().toISOString(),
      databases_scanned: 1,
    }).eq("id", scanRunId);

    // Update user risk snapshot
    await supabase.from("user_risk_snapshots").insert({
      user_id: userId,
      risk_score: riskScore,
      breaches_detected: breachesInserted,
    }).catch(() => {});

    // Completion alert
    await supabase.from("alerts").insert({
      user_id: userId,
      type: "system",
      title: "Live breach scan complete",
      body: breachesInserted > 0
        ? `Found ${breachesInserted} real breach exposure(s) via Have I Been Pwned. Risk score: ${riskScore}.`
        : "No breach exposures found for your email. Stay protected!",
      severity: riskScore >= 76 ? "critical" : riskScore >= 51 ? "high" : riskScore >= 26 ? "medium" : "low",
      related_scan_run_id: scanRunId,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        scan_run_id: scanRunId,
        breaches_found: breachesInserted,
        risk_score: riskScore,
        settlements_matched: matchedSettlementIds.length,
        source: "hibp",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("hibp-scan error:", err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
