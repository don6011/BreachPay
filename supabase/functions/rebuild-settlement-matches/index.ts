/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: "Missing env vars" }, 500);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Optional: rebuild for a single settlement_id
  const url = new URL(req.url);
  const settlementOverride = url.searchParams.get("settlement_id");

  // Fetch settlements
  let sQuery = supabase
    .from("settlements")
    .select("id, company, breach_year, payout_min, payout_max, status")
    .in("status", ["open", "pending"]);

  if (settlementOverride) sQuery = sQuery.eq("id", settlementOverride);

  const { data: settlements, error: sErr } = await sQuery;
  if (sErr) return jsonResponse({ error: sErr.message }, 500);
  if (!settlements?.length) return jsonResponse({ ok: true, created: 0, message: "No settlements to rebuild" });

  // Fetch users who have breaches
  const { data: users, error: uErr } = await supabase
    .from("breach_events")
    .select("user_id")
    .limit(5000);

  if (uErr) return jsonResponse({ error: uErr.message }, 500);

  const userIds = Array.from(new Set((users ?? []).map((r) => r.user_id)));
  if (!userIds.length) return jsonResponse({ ok: true, created: 0, message: "No users with breach events" });

  let created = 0;

  // Process in chunks
  const chunkSize = 50;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);

    // Fetch breaches for these users
    const { data: breaches, error: bErr } = await supabase
      .from("breach_events")
      .select("user_id, source, breach_year")
      .in("user_id", chunk);

    if (bErr) continue;

    const byUser = new Map<string, { source: string; breach_year: number | null }[]>();
    for (const b of breaches ?? []) {
      const uid = b.user_id as string;
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push({ source: String(b.source), breach_year: (b.breach_year as number) ?? null });
    }

    const inserts: any[] = [];
    for (const uid of chunk) {
      const userBreaches = byUser.get(uid) ?? [];
      for (const sett of settlements) {
        const company = norm(String(sett.company || ""));
        const year = sett.breach_year as number | null;

        const hit = userBreaches.find((br) => {
          const src = norm(br.source);
          const companyMatch = company.includes(src) || src.includes(company);
          const yearOk = !year || !br.breach_year || year === br.breach_year;
          return companyMatch && yearOk;
        });

        if (hit) {
          const payoutEstimate =
            sett.payout_min && sett.payout_max ? (Number(sett.payout_min) + Number(sett.payout_max)) / 2 : null;

          inserts.push({
            user_id: uid,
            settlement_id: sett.id,
            match_reason: `Matched via ${hit.source} breach exposure`,
            status: sett.status,
            payout_estimate: payoutEstimate,
          });
        }
      }
    }

    if (!inserts.length) continue;

    const { data: upserted, error: upErr } = await supabase
      .from("settlement_matches")
      .upsert(inserts, { onConflict: "user_id,settlement_id" })
      .select("user_id, settlement_id");

    if (!upErr) created += upserted?.length ?? 0;
  }

  // Optional: create alerts for users (kept minimal to avoid spam). You can add later.
  return jsonResponse({ ok: true, created });
});