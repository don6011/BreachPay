/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    if (!token) {
      return new Response(JSON.stringify({ ok: false, error: "missing_token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bucket = Deno.env.get("PACKET_BUCKET") ?? "claim-packets";

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const token_hash = await sha256Hex(token);

    // Find share link
    const { data: link, error: linkErr } = await supabase
      .from("claim_share_links")
      .select("id, claim_id, scope, expires_at, revoked_at, access_count")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (linkErr || !link) {
      return new Response(JSON.stringify({ ok: false, error: "invalid" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (link.revoked_at) {
      return new Response(JSON.stringify({ ok: false, error: "revoked" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(link.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ ok: false, error: "expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get latest packet for claim
    const { data: packet } = await supabase
      .from("claim_packets")
      .select("pdf_storage_path, generated_at")
      .eq("claim_id", link.claim_id)
      .eq("status", "generated")
      .not("pdf_storage_path", "is", null)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch claim + settlement info for display
    const { data: claim } = await supabase
      .from("claims")
      .select("status, settlement_id")
      .eq("id", link.claim_id)
      .maybeSingle();

    if (!claim) {
      return new Response(JSON.stringify({ ok: false, error: "claim_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settlement } = await supabase
      .from("settlements")
      .select("name, company")
      .eq("id", claim.settlement_id)
      .maybeSingle();

    // Generate signed URL for packet (15 min)
    let downloadUrl: string | null = null;
    if (packet?.pdf_storage_path) {
      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrl(packet.pdf_storage_path, 60 * 15);
      downloadUrl = signed?.signedUrl || null;
    }

    // Update access metrics
    await supabase
      .from("claim_share_links")
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: (link.access_count ?? 0) + 1,
      })
      .eq("id", link.id);

    return new Response(JSON.stringify({
      ok: true,
      settlement_name: settlement?.name ?? "Claim Packet",
      company: settlement?.company ?? "",
      claim_status: claim.status,
      expires_at: link.expires_at,
      download_url: downloadUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
