import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Demo breach sources for deterministic generation
const DEMO_SOURCES = [
  { company: "Facebook", year: 2021, fields: ["email", "phone", "name", "location"], risk: "high" },
  { company: "LinkedIn", year: 2021, fields: ["email", "name", "phone"], risk: "medium" },
  { company: "Yahoo", year: 2016, fields: ["email", "password", "security_questions"], risk: "critical" },
  { company: "Equifax", year: 2017, fields: ["ssn", "name", "address", "dob"], risk: "critical" },
  { company: "Adobe", year: 2013, fields: ["email", "password", "credit_card"], risk: "high" },
  { company: "Marriott", year: 2018, fields: ["passport", "email", "credit_card"], risk: "high" },
  { company: "Capital One", year: 2019, fields: ["ssn", "bank_account", "name"], risk: "critical" },
  { company: "T-Mobile", year: 2023, fields: ["phone", "ssn", "name", "address"], risk: "high" },
  { company: "Twitter", year: 2022, fields: ["email", "phone"], risk: "medium" },
  { company: "Dropbox", year: 2012, fields: ["email", "password"], risk: "medium" },
  { company: "Canva", year: 2019, fields: ["email", "name", "password"], risk: "medium" },
  { company: "MyFitnessPal", year: 2018, fields: ["email", "password", "username"], risk: "low" },
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickBreaches(userId: string): typeof DEMO_SOURCES {
  const h = hashCode(userId);
  const count = 3 + (h % 6); // 3-8 breaches
  const shuffled = [...DEMO_SOURCES].sort((a, b) => hashCode(a.company + userId) - hashCode(b.company + userId));
  return shuffled.slice(0, count);
}

function computeRiskScore(breaches: typeof DEMO_SOURCES): number {
  const weights: Record<string, number> = { critical: 25, high: 15, medium: 8, low: 3 };
  const fieldWeights: Record<string, number> = { ssn: 20, passport: 18, credit_card: 15, bank_account: 15, password: 10, phone: 5, email: 3, name: 2, address: 3, dob: 5, location: 2, username: 1, security_questions: 8 };
  let score = 0;
  for (const b of breaches) {
    score += weights[b.risk] || 5;
    for (const f of b.fields) score += fieldWeights[f] || 2;
  }
  return Math.min(score, 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Optional: target a specific user
    let targetUserId: string | null = null;
    try {
      const body = await req.json();
      targetUserId = body?.user_id || null;
    } catch { /* no body */ }

    const runKey = `scan:${new Date().toISOString().slice(0, 13)}`; // hourly key

    // Idempotency check (skip for single-user override)
    if (!targetUserId) {
      const { error: idempErr } = await sb.from("automation_runs").insert({
        job_name: "run_scheduled_scans",
        run_key: runKey,
        status: "running",
      });
      if (idempErr?.code === "23505") {
        return new Response(JSON.stringify({ message: "Already ran this hour" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Find eligible users
    let query = sb.from("user_profiles").select("user_id, plan, scan_frequency_days").eq("monitoring_enabled", true);
    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    } else {
      query = query.lte("next_scan_at", new Date().toISOString());
    }
    const { data: users, error: usersErr } = await query;
    if (usersErr) throw usersErr;

    let totalScanned = 0;
    let totalBreaches = 0;
    let totalMatches = 0;

    for (const user of users || []) {
      const userId = user.user_id;
      const breaches = pickBreaches(userId);
      const riskScore = computeRiskScore(breaches);

      // 1. Create scan_run
      const { data: scanRun } = await sb.from("scan_runs").insert({
        user_id: userId,
        status: "running",
        started_at: new Date().toISOString(),
      }).select("id").single();

      if (!scanRun) continue;
      const scanRunId = scanRun.id;

      // 2. Insert breach_events
      const breachRows = breaches.map((b) => ({
        user_id: userId,
        scan_run_id: scanRunId,
        source: b.company,
        breach_year: b.year,
        risk_level: b.risk,
        exposed_fields: b.fields,
        record_count_estimate: hashCode(b.company + userId) % 500_000_000,
        details: { demo: true },
      }));
      await sb.from("breach_events").insert(breachRows);

      // 3. Risk snapshot
      await sb.from("user_risk_snapshots").insert({
        user_id: userId,
        risk_score: riskScore,
        breaches_detected: breaches.length,
      });

      // 4. Settlement matching
      const { data: settlements } = await sb.from("settlements").select("*").eq("status", "open");

      let matchCount = 0;
      for (const s of settlements || []) {
        const companyLower = s.company.toLowerCase();
        const matched = breaches.some((b) => {
          const srcLower = b.company.toLowerCase();
          const companyMatch = companyLower.includes(srcLower) || srcLower.includes(companyLower);
          const yearMatch = !s.breach_year || s.breach_year === b.year;
          return companyMatch && yearMatch;
        });

        if (matched) {
          const confidence = breaches.some(b => b.company.toLowerCase() === companyLower && s.breach_year === b.year) ? 90
            : breaches.some(b => b.company.toLowerCase() === companyLower) ? 70 : 50;
          const estimate = s.payout_min ? (Number(s.payout_min) + Number(s.payout_max || s.payout_min)) / 2 : null;

          const { error: matchErr } = await sb.from("settlement_matches").upsert({
            user_id: userId,
            settlement_id: s.id,
            scan_run_id: scanRunId,
            payout_estimate: estimate,
            match_reason: `Company match (${confidence}% confidence)`,
            status: "open",
          }, { onConflict: "user_id,settlement_id" });

          if (!matchErr) matchCount++;
        }
      }

      // 5. Update scan_run
      await sb.from("scan_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        risk_score: riskScore,
        breaches_detected: breaches.length,
        databases_scanned: DEMO_SOURCES.length,
        eligible_settlements: matchCount,
      }).eq("id", scanRunId);

      // 6. Create alerts
      const alerts = [
        {
          user_id: userId,
          type: "breach_detected",
          title: `${breaches.length} breaches detected`,
          body: `Your data was found in ${breaches.map(b => b.company).join(", ")}.`,
          severity: riskScore > 60 ? "critical" : riskScore > 30 ? "high" : "medium",
          related_scan_run_id: scanRunId,
        },
      ];
      if (matchCount > 0) {
        alerts.push({
          user_id: userId,
          type: "settlement_found",
          title: `${matchCount} settlement${matchCount > 1 ? "s" : ""} matched`,
          body: `You may be eligible for compensation from ${matchCount} active settlement${matchCount > 1 ? "s" : ""}.`,
          severity: "low",
          related_scan_run_id: scanRunId,
        });
      }
      await sb.from("alerts").insert(alerts);

      // 7. Update user profile
      const freqDays = user.plan === "premium" ? 1 : 7;
      const nextScan = new Date();
      nextScan.setDate(nextScan.getDate() + freqDays);

      await sb.from("user_profiles").update({
        last_scan_at: new Date().toISOString(),
        next_scan_at: nextScan.toISOString(),
      }).eq("user_id", userId);

      totalScanned++;
      totalBreaches += breaches.length;
      totalMatches += matchCount;
    }

    // Update automation run
    if (!targetUserId) {
      await sb.from("automation_runs").update({
        status: "success",
        completed_at: new Date().toISOString(),
        details: { users_scanned: totalScanned, breaches: totalBreaches, matches: totalMatches },
      }).eq("job_name", "run_scheduled_scans").eq("run_key", runKey);
    }

    return new Response(JSON.stringify({
      success: true,
      users_scanned: totalScanned,
      breaches_generated: totalBreaches,
      matches_found: totalMatches,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
