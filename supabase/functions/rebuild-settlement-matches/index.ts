import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const runKey = `matches:${new Date().toISOString().slice(0, 13)}`;

    const { error: idempErr } = await sb.from("automation_runs").insert({
      job_name: "rebuild_settlement_matches",
      run_key: runKey,
      status: "running",
    });
    if (idempErr?.code === "23505") {
      return new Response(JSON.stringify({ message: "Already ran this hour" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all open settlements
    const { data: settlements } = await sb.from("settlements").select("*").eq("status", "open");
    if (!settlements?.length) {
      await sb.from("automation_runs").update({
        status: "success", completed_at: new Date().toISOString(),
        details: { message: "No open settlements" },
      }).eq("job_name", "rebuild_settlement_matches").eq("run_key", runKey);

      return new Response(JSON.stringify({ success: true, matches: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all users with breaches (paginate with limit)
    const { data: breaches } = await sb
      .from("breach_events")
      .select("user_id, source, breach_year")
      .limit(5000);

    // Group breaches by user
    const userBreaches: Record<string, Array<{ source: string; breach_year: number | null }>> = {};
    for (const b of breaches || []) {
      if (!userBreaches[b.user_id]) userBreaches[b.user_id] = [];
      userBreaches[b.user_id].push({ source: b.source, breach_year: b.breach_year });
    }

    let newMatches = 0;
    let alertsCreated = 0;

    for (const [userId, userBreach] of Object.entries(userBreaches)) {
      for (const s of settlements) {
        const companyLower = s.company.toLowerCase();

        const matched = userBreach.some((b) => {
          const srcLower = b.source.toLowerCase();
          const companyMatch = companyLower.includes(srcLower) || srcLower.includes(companyLower);
          const yearMatch = !s.breach_year || s.breach_year === b.breach_year;
          return companyMatch && yearMatch;
        });

        if (!matched) continue;

        const confidence = userBreach.some(b => b.source.toLowerCase() === companyLower && s.breach_year === b.breach_year) ? 90
          : userBreach.some(b => b.source.toLowerCase() === companyLower) ? 70 : 50;
        const estimate = s.payout_min ? (Number(s.payout_min) + Number(s.payout_max || s.payout_min)) / 2 : null;

        const { error: matchErr, data: matchData } = await sb.from("settlement_matches").upsert({
          user_id: userId,
          settlement_id: s.id,
          payout_estimate: estimate,
          match_reason: `Company match (${confidence}% confidence)`,
          status: "open",
        }, { onConflict: "user_id,settlement_id", ignoreDuplicates: false }).select("id");

        if (!matchErr && matchData?.length) {
          newMatches++;

          // Create alert for new matches
          await sb.from("alerts").insert({
            user_id: userId,
            type: "settlement_found",
            title: `New settlement match: ${s.name}`,
            body: `You may be eligible for $${estimate?.toLocaleString() || "unknown"} from the ${s.company} settlement.`,
            severity: "low",
            related_settlement_id: s.id,
          });
          alertsCreated++;
        }
      }
    }

    await sb.from("automation_runs").update({
      status: "success",
      completed_at: new Date().toISOString(),
      details: { new_matches: newMatches, alerts_created: alertsCreated, users_checked: Object.keys(userBreaches).length },
    }).eq("job_name", "rebuild_settlement_matches").eq("run_key", runKey);

    return new Response(JSON.stringify({
      success: true,
      new_matches: newMatches,
      alerts_created: alertsCreated,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
