/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64Url(bytes: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(lengthBytes = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(lengthBytes));
  return base64Url(bytes);
}

function parseExpiresIn(expiresIn: string): number {
  const v = (expiresIn || "").trim().toLowerCase();
  if (v === "24h") return 24 * 60 * 60 * 1000;
  if (v === "7d") return 7 * 24 * 60 * 60 * 1000;
  if (v === "30d") return 30 * 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000; // default 7d
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appBaseUrl = Deno.env.get("APP_BASE_URL")!;

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const jwtToken = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authErr } = await supabaseUser.auth.getClaims(jwtToken);
    if (authErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    const { claim_id, expires_in } = await req.json();
    if (!claim_id) {
      return new Response(JSON.stringify({ ok: false, error: "missing_claim_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Authorization: must own claim or be admin
    const { data: claimRow, error: claimErr } = await admin
      .from("claims")
      .select("id, user_id")
      .eq("id", claim_id)
      .maybeSingle();

    if (claimErr || !claimRow) {
      return new Response(JSON.stringify({ ok: false, error: "claim_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (claimRow.user_id !== callerId) {
      const { data: isAdm } = await admin.rpc("is_admin", { p_user: callerId });
      if (!isAdm) {
        return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Generate token
    const token = randomToken(32);
    const token_hash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + parseExpiresIn(expires_in ?? "7d")).toISOString();

    const { error: insErr } = await admin.from("claim_share_links").insert({
      claim_id,
      token_hash,
      scope: "packet",
      expires_at: expiresAt,
      created_by: callerId,
    });

    if (insErr) throw new Error(`insert_failed: ${insErr.message}`);

    const shareUrl = `${appBaseUrl.replace(/\/$/, "")}/share/claim?token=${encodeURIComponent(token)}`;

    return new Response(JSON.stringify({
      ok: true,
      share_url: shareUrl,
      expires_at: expiresAt,
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
