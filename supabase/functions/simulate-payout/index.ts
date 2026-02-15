/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return json({ error: "Missing env vars" }, 500);
  }

  // --- Auth: require admin ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !userData?.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Check admin role
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return json({ error: "Forbidden" }, 403);
  }

  // --- Parse body ---
  const { claim_id } = await req.json();
  if (!claim_id) return json({ error: "claim_id required" }, 400);

  // Fetch claim
  const { data: claim, error: claimErr } = await supabase
    .from("claims")
    .select("id, user_id, net_payout, status, settlement_id")
    .eq("id", claim_id)
    .single();

  if (claimErr || !claim) return json({ error: "Claim not found" }, 404);

  if (claim.status === "paid") {
    return json({ error: "Claim already paid" }, 400);
  }

  // Create a Stripe PaymentIntent in test mode for audit trail
  const payoutAmount = claim.net_payout ?? 0;
  let stripeRef = `sim_${claim.id.slice(0, 8)}_${Date.now()}`;

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const pi = await stripe.paymentIntents.create({
        amount: Math.round(payoutAmount * 100), // cents
        currency: "usd",
        metadata: {
          claim_id: claim.id,
          user_id: claim.user_id,
          type: "payout_simulation",
        },
        description: `BreachPay payout for claim ${claim.id.slice(0, 8)}`,
        confirm: false,
      });
      stripeRef = pi.id;
      console.log("Stripe PaymentIntent created:", pi.id);
    } catch (stripeErr) {
      console.warn("Stripe PI creation failed, using sim ref:", stripeErr);
    }
  }

  // Insert payout record
  const { error: payoutErr } = await supabase.from("payouts").insert({
    claim_id: claim.id,
    user_id: claim.user_id,
    amount: payoutAmount,
    currency: "usd",
    status: "paid",
    stripe_ref: stripeRef,
    paid_at: new Date().toISOString(),
  });

  if (payoutErr) {
    console.error("Payout insert error:", payoutErr);
    return json({ error: "Failed to create payout record" }, 500);
  }

  // Update claim status to paid
  await supabase
    .from("claims")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", claim.id);

  // Log status change in claim_status_history
  await supabase.from("claim_status_history").insert({
    claim_id: claim.id,
    status: "paid",
    updated_by: userData.user.id,
    note: `Payout of $${payoutAmount.toFixed(2)} issued. Ref: ${stripeRef}`,
  });

  // Alert user
  await supabase.from("alerts").insert({
    user_id: claim.user_id,
    type: "payout_update",
    title: "Payout sent",
    body: `Your claim payout of $${payoutAmount.toFixed(2)} has been issued. Check your wallet for details.`,
    severity: "low",
    related_claim_id: claim.id,
    related_settlement_id: claim.settlement_id,
  });

  // Admin activity log
  await supabase.from("admin_activity_logs").insert({
    admin_user_id: userData.user.id,
    action: "Processed payout",
    entity_type: "claim",
    entity_id: claim.id,
    meta: { amount: payoutAmount, stripe_ref: stripeRef },
  });

  return json({ ok: true, stripe_ref: stripeRef, amount: payoutAmount });
});
