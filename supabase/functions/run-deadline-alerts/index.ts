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

    const runKey = `deadline:${new Date().toISOString().slice(0, 10)}`;

    // Idempotency
    const { error: idempErr } = await sb.from("automation_runs").insert({
      job_name: "run_deadline_alerts",
      run_key: runKey,
      status: "running",
    });
    if (idempErr?.code === "23505") {
      return new Response(JSON.stringify({ message: "Already ran today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all open settlements with deadlines
    const { data: settlements } = await sb
      .from("settlements")
      .select("id, name, company, deadline")
      .eq("status", "open")
      .not("deadline", "is", null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let alertsSent = 0;

    for (const s of settlements || []) {
      const deadline = new Date(s.deadline);
      const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft < 0) continue;

      // Get users matched to this settlement
      const { data: matches } = await sb
        .from("settlement_matches")
        .select("user_id")
        .eq("settlement_id", s.id)
        .eq("status", "open");

      if (!matches?.length) continue;

      for (const match of matches) {
        // Get user plan
        const { data: profile } = await sb
          .from("user_profiles")
          .select("plan")
          .eq("user_id", match.user_id)
          .single();

        const thresholds = profile?.plan === "premium" ? [30, 14, 3] : [14, 3];

        for (const threshold of thresholds) {
          if (daysLeft !== threshold) continue;

          // Check if already sent
          const { data: existing } = await sb
            .from("deadline_alerts_sent")
            .select("user_id")
            .eq("user_id", match.user_id)
            .eq("settlement_id", s.id)
            .eq("threshold_days", threshold)
            .maybeSingle();

          if (existing) continue;

          // Create alert
          const severity = threshold <= 3 ? "critical" : threshold <= 14 ? "high" : "medium";
          await sb.from("alerts").insert({
            user_id: match.user_id,
            type: "deadline_alert",
            title: `${threshold} days left: ${s.name}`,
            body: `The deadline for ${s.company} settlement is ${s.deadline}. File your claim before it expires.`,
            severity,
            related_settlement_id: s.id,
          });

          // Mark as sent
          await sb.from("deadline_alerts_sent").insert({
            user_id: match.user_id,
            settlement_id: s.id,
            threshold_days: threshold,
          });

          alertsSent++;
        }
      }
    }

    await sb.from("automation_runs").update({
      status: "success",
      completed_at: new Date().toISOString(),
      details: { alerts_sent: alertsSent },
    }).eq("job_name", "run_deadline_alerts").eq("run_key", runKey);

    return new Response(JSON.stringify({ success: true, alerts_sent: alertsSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
