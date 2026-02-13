/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RiskLevel = "low" | "medium" | "high" | "critical";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function hash32(input: string): number {
  // Deterministic simple hash for demo results
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number, count: number): T[] {
  const out: T[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const idx = seed % arr.length;
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(arr[idx]);
    if (out.length >= count) break;
  }
  return out;
}

function riskScoreFromBreaches(breaches: { risk_level: RiskLevel; exposed_fields: string[] }[]): number {
  let score = 0;
  for (const b of breaches) {
    score += b.risk_level === "critical" ? 25 : b.risk_level === "high" ? 18 : b.risk_level === "medium" ? 10 : 5;
    if (b.exposed_fields.includes("password")) score += 12;
    if (b.exposed_fields.includes("ssn")) score += 25;
    if (b.exposed_fields.includes("financial")) score += 15;
    if (b.exposed_fields.includes("phone")) score += 5;
    if (b.exposed_fields.includes("address")) score += 5;
  }
  return Math.max(0, Math.min(100, score));
}

function labelFromScore(score: number): { severity: RiskLevel } {
  if (score >= 76) return { severity: "critical" };
  if (score >= 51) return { severity: "high" };
  if (score >= 26) return { severity: "medium" };
  return { severity: "low" };
}

function daysFromPlan(plan: "free" | "premium"): number {
  return plan === "premium" ? 1 : 7;
}

function demoBreachesForUser(userId: string) {
  const catalog = [
    { source: "Equifax", year: 2017, fields: ["ssn", "address", "name"], level: "critical" as RiskLevel },
    { source: "LinkedIn", year: 2012, fields: ["email", "password"], level: "high" as RiskLevel },
    { source: "T-Mobile", year: 2021, fields: ["ssn", "phone", "address"], level: "critical" as RiskLevel },
    { source: "Adobe", year: 2013, fields: ["email", "password"], level: "high" as RiskLevel },
    { source: "Canva", year: 2019, fields: ["email", "username"], level: "medium" as RiskLevel },
    { source: "Dropbox", year: 2012, fields: ["email", "password"], level: "high" as RiskLevel },
    { source: "MyFitnessPal", year: 2018, fields: ["email", "password"], level: "medium" as RiskLevel },
    { source: "Twitter", year: 2022, fields: ["email", "phone"], level: "medium" as RiskLevel },
    { source: "AT&T", year: 2024, fields: ["phone", "address"], level: "high" as RiskLevel },
    { source: "Marriott", year: 2018, fields: ["passport", "address", "email"], level: "high" as RiskLevel },
  ];

  const seed = hash32(userId);
  const count = 3 + (seed % 5); // 3–7 breaches
  return pick(catalog, seed, count).map((b) => ({
    source: b.source,
    breach_year: b.year,
    risk_level: b.level,
    exposed_fields: b.fields,
    details: { demo: true },
  }));
}

async function upsertSettlementMatches(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  scanRunId: string,
  breaches: { source: string; breach_year: number | null }[],
) {
  // Pull open settlements
  const { data: settlements, error: sErr } = await supabase
    .from("settlements")
    .select("id, company, breach_year, payout_min, payout_max, status")
    .in("status", ["open", "pending"]);

  if (sErr) throw sErr;
  if (!settlements?.length) return { created: 0 };

  // Basic matching: company contains breach source or vice versa, optional year match
  const matchesToInsert: any[] = [];
  for (const sett of settlements) {
    const company = String(sett.company || "").toLowerCase();
    for (const br of breaches) {
      const src = String(br.source || "").toLowerCase();
      const yearOk = !sett.breach_year || !br.breach_year || sett.breach_year === br.breach_year;
      const companyMatch = company.includes(src) || src.includes(company);
      if (companyMatch && yearOk) {
        const payoutEstimate =
          sett.payout_min && sett.payout_max
            ? (Number(sett.payout_min) + Number(sett.payout_max)) / 2
            : null;

        matchesToInsert.push({
          user_id: userId,
          settlement_id: sett.id,
          scan_run_id: scanRunId,
          match_reason: `Matched via ${br.source} breach exposure`,
          status: sett.status,
          payout_estimate: payoutEstimate,
        });
        break;
      }
    }
  }

  if (!matchesToInsert.length) return { created: 0 };

  // Upsert on (user_id, settlement_id) unique constraint
  const { data: upserted, error: uErr } = await supabase
    .from("settlement_matches")
    .upsert(matchesToInsert, { onConflict: "user_id,settlement_id" })
    .select("id, settlement_id, user_id, created_at");

  if (uErr) throw uErr;

  // Count "new" by comparing against existing? Upsert doesn't tell. For MVP, treat as created if returned rows.
  return { created: upserted?.length ?? 0, settlement_ids: upserted?.map((r) => r.settlement_id) ?? [] };
}

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: "Missing env vars" }, 500);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Optional override: run for a single user_id
  const url = new URL(req.url);
  const userOverride = url.searchParams.get("user_id");

  // Find due users
  let q = supabase
    .from("user_profiles")
    .select("user_id, plan, monitoring_enabled, next_scan_at")
    .eq("monitoring_enabled", true)
    .lte("next_scan_at", new Date().toISOString());

  if (userOverride) q = q.eq("user_id", userOverride);

  const { data: dueUsers, error: dueErr } = await q.limit(50);
  if (dueErr) return jsonResponse({ error: dueErr.message }, 500);

  const results: any[] = [];
  for (const u of dueUsers ?? []) {
    const userId = u.user_id as string;
    const plan = (u.plan as "free" | "premium") ?? "free";

    // Create scan run
    const { data: scanRun, error: srErr } = await supabase
      .from("scan_runs")
      .insert({
        user_id: userId,
        status: "running",
        provider: "demo",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (srErr) {
      results.push({ user_id: userId, ok: false, error: srErr.message });
      continue;
    }

    const scanRunId = scanRun.id as string;

    try {
      // Generate demo breaches
      const demoBreaches = demoBreachesForUser(userId);

      // Insert breach_events
      const { error: bErr } = await supabase.from("breach_events").insert(
        demoBreaches.map((b) => ({
          user_id: userId,
          scan_run_id: scanRunId,
          source: b.source,
          breach_year: b.breach_year,
          risk_level: b.risk_level,
          exposed_fields: b.exposed_fields,
          details: b.details,
        })),
      );
      if (bErr) throw bErr;

      const riskScore = riskScoreFromBreaches(
        demoBreaches.map((b) => ({ risk_level: b.risk_level, exposed_fields: b.exposed_fields })),
      );
      const risk = labelFromScore(riskScore);

      // Insert risk snapshot
      await supabase.from("user_risk_snapshots").insert({
        user_id: userId,
        risk_score: riskScore,
        breaches_detected: demoBreaches.length,
      });

      // Settlement matching
      const matchRes = await upsertSettlementMatches(
        supabase,
        userId,
        scanRunId,
        demoBreaches.map((b) => ({ source: b.source, breach_year: b.breach_year })),
      );

      // Alerts: scan complete + breach detected + settlement found
      const alertsToInsert: any[] = [
        {
          user_id: userId,
          type: "system",
          title: "Secure scan complete",
          body: `We detected ${demoBreaches.length} breach exposures.`,
          severity: risk.severity,
          related_scan_run_id: scanRunId,
        },
      ];

      alertsToInsert.push(
        ...demoBreaches.slice(0, 5).map((b) => ({
          user_id: userId,
          type: "breach_detected",
          title: "New breach exposure detected",
          body: `${b.source} (${b.breach_year}) — exposed: ${b.exposed_fields.join(", ")}`,
          severity: b.risk_level,
          related_scan_run_id: scanRunId,
        })),
      );

      if (matchRes.created > 0) {
        alertsToInsert.push({
          user_id: userId,
          type: "settlement_found",
          title: "You may qualify for compensation",
          body: `We matched ${matchRes.created} settlement(s) to your breach exposures.`,
          severity: "medium",
          related_scan_run_id: scanRunId,
        });
      }

      await supabase.from("alerts").insert(alertsToInsert);

      // Complete scan run
      await supabase
        .from("scan_runs")
        .update({
          status: "completed",
          breaches_detected: demoBreaches.length,
          eligible_settlements: matchRes.created,
          risk_score: riskScore,
          completed_at: new Date().toISOString(),
          databases_scanned: 12000, // demo display
        })
        .eq("id", scanRunId);

      // Update user profile scan schedule
      const next = new Date();
      next.setDate(next.getDate() + daysFromPlan(plan));

      await supabase
        .from("user_profiles")
        .update({
          last_scan_at: new Date().toISOString(),
          next_scan_at: next.toISOString(),
          scan_frequency_days: daysFromPlan(plan),
        })
        .eq("user_id", userId);

      results.push({ user_id: userId, ok: true, scan_run_id: scanRunId, breaches: demoBreaches.length, matches: matchRes.created });
    } catch (e) {
      const msg = e?.message ?? String(e);
      await supabase.from("scan_runs").update({ status: "failed", error_message: msg }).eq("id", scanRunId);
      results.push({ user_id: userId, ok: false, scan_run_id: scanRunId, error: msg });
    }
  }

  return jsonResponse({ ok: true, processed: results.length, results });
});