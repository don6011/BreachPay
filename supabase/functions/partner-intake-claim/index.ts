import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { partner_id, full_name, email, breach, notes } = await req.json();

    if (!partner_id || !email || !breach) {
      return new Response(JSON.stringify({ error: "partner_id, email, and breach are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate partner
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

    // Log intake
    const { data: log, error: logErr } = await supabase
      .from("partner_intake_logs")
      .insert({
        partner_id,
        intake_type: "claim",
        email,
        full_name: full_name || null,
        breach_company: breach,
        notes: notes || null,
        status: "processing",
      })
      .select("id")
      .single();

    if (logErr) throw logErr;

    // Find or create user
    let userId: string;
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const found = existingUser?.users?.find((u) => u.email === email);

    if (found) {
      userId = found.id;
    } else {
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

    // Find matching settlement
    const { data: settlement } = await supabase
      .from("settlements")
      .select("id")
      .ilike("company", `%${breach}%`)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!settlement) {
      await supabase.from("partner_intake_logs").update({
        status: "failed",
        meta: { error: "No matching settlement found" },
      }).eq("id", log.id);

      return new Response(JSON.stringify({ error: "No matching settlement found for this breach" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create draft claim
    const { data: claim, error: claimErr } = await supabase
      .from("claims")
      .insert({
        user_id: userId,
        settlement_id: settlement.id,
        status: "draft",
        partner_id: partner.id,
      })
      .select("id")
      .single();

    if (claimErr) throw claimErr;

    // Create claim application with prefilled data
    await supabase.from("claim_applications").insert({
      claim_id: claim.id,
      full_name: full_name || null,
      email,
      breach_experience: notes || null,
    });

    // Assign claim to partner
    await supabase.from("claim_assignments").insert({
      claim_id: claim.id,
      partner_id: partner.id,
      assignment_status: "assigned",
    });

    // Create referral
    await supabase.from("referrals").insert({
      partner_id: partner.id,
      claim_id: claim.id,
      model: "cpa",
      status: "pending",
    });

    // Update intake log
    await supabase.from("partner_intake_logs").update({
      status: "completed",
      result_user_id: userId,
      result_claim_id: claim.id,
      processed_at: new Date().toISOString(),
    }).eq("id", log.id);

    return new Response(JSON.stringify({
      success: true,
      intake_id: log.id,
      claim_id: claim.id,
      user_id: userId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("partner-intake-claim error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
