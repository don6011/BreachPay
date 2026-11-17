import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user with their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Remove the user's uploaded files and generated claim packets. Files live
    // under a folder named after the user id, sometimes one level deeper.
    const removeFolder = async (bucket: string, prefix: string, depth = 0): Promise<void> => {
      const { data: entries } = await adminClient.storage.from(bucket).list(prefix, { limit: 1000 });
      if (!entries?.length) return;
      const files: string[] = [];
      for (const entry of entries) {
        const path = `${prefix}/${entry.name}`;
        // Folders come back without an id.
        if (entry.id === null && depth < 3) await removeFolder(bucket, path, depth + 1);
        else files.push(path);
      }
      if (files.length) await adminClient.storage.from(bucket).remove(files);
    };
    for (const bucket of ["claim-documents", "claim-packets"]) {
      try {
        await removeFolder(bucket, user.id);
      } catch (e) {
        console.error(`Failed to clear ${bucket} for deleted user:`, e);
      }
    }

    // Records keyed by something other than a plain user_id column.
    await adminClient.from("user_referrals").delete().eq("referrer_user_id", user.id);
    await adminClient.from("user_referrals").delete().eq("referred_user_id", user.id);
    await adminClient.from("claim_share_links").delete().eq("created_by", user.id);

    // Delete user data from public tables (cascade will handle some, but be explicit)
    const tables = [
      "user_payment_methods",
      "user_fingerprints",
      "support_tickets",
      "subscriptions",
      "upsell_clicks",
      "fraud_flags",
      "claim_documents",
      "claim_applications",
      "claim_services",
      "claim_attempts",
      "payouts",
      "claims",
      "breach_events",
      "settlement_matches",
      "scan_runs",
      "scan_job_queue",
      "scan_schedule",
      "alerts",
      "notification_outbox",
      "monitored_identifiers",
      "data_deletion_requests",
      "product_events",
      "deadline_alerts_sent",
    ];

    for (const table of tables) {
      await adminClient.from(table).delete().eq("user_id", user.id);
    }

    // Delete user profile
    await adminClient.from("user_profiles").delete().eq("user_id", user.id);
    await adminClient.from("user_roles").delete().eq("user_id", user.id);
    await adminClient.from("user_risk_snapshots").delete().eq("user_id", user.id);
    await adminClient.from("user_risk_flags").delete().eq("user_id", user.id);

    // Delete auth user (this is the final step)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Failed to delete auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Delete account error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
