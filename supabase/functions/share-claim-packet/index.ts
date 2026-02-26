/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // base64url encode
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const url = new URL(req.url);

  // ---- POST: Create a share link (authenticated) ----
  if (req.method === "POST") {
    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: authHeader } },
      });

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: authErr } = await supabaseUser.auth.getClaims(token);
      if (authErr || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const userId = claimsData.claims.sub as string;

      const body = await req.json();
      const { claim_id, scope = "packet", hours = 168 } = body; // default 7 days
      if (!claim_id) throw new Error("Missing claim_id");

      const admin = createClient(supabaseUrl, serviceKey);

      // Verify ownership
      const { data: claim } = await admin.from("claims").select("id, user_id").eq("id", claim_id).maybeSingle();
      if (!claim || claim.user_id !== userId) {
        const { data: isAdm } = await admin.rpc("is_admin", { p_user: userId });
        if (!isAdm) throw new Error("Access denied");
      }

      // Generate token
      const rawToken = generateToken();
      const tokenHash = await hashToken(rawToken);

      // Insert share link
      const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      const { data: link, error: insertErr } = await admin
        .from("claim_share_links")
        .insert({
          claim_id,
          token_hash: tokenHash,
          scope,
          expires_at: expiresAt,
          created_by: userId,
        })
        .select("id, expires_at, scope")
        .single();

      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({
        token: rawToken,
        expires_at: link.expires_at,
        scope: link.scope,
        id: link.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ---- GET: Resolve a share token (public, no auth needed) ----
  if (req.method === "GET") {
    try {
      const rawToken = url.searchParams.get("token");
      if (!rawToken) {
        return new Response(JSON.stringify({ error: "Missing token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenHash = await hashToken(rawToken);
      const admin = createClient(supabaseUrl, serviceKey);

      // Find share link
      const { data: share, error: shareErr } = await admin
        .from("claim_share_links")
        .select("*")
        .eq("token_hash", tokenHash)
        .is("revoked_at", null)
        .maybeSingle();

      if (shareErr || !share) {
        return new Response(JSON.stringify({ error: "Invalid or expired link" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new Date(share.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "This share link has expired" }), {
          status: 410,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Bump access counter
      await admin
        .from("claim_share_links")
        .update({
          access_count: (share.access_count || 0) + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq("id", share.id);

      const claimId = share.claim_id;

      // Get latest packet
      const { data: packet } = await admin
        .from("claim_packets")
        .select("*")
        .eq("claim_id", claimId)
        .eq("status", "generated")
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get claim + settlement metadata
      const { data: claim } = await admin
        .from("claims")
        .select("id, status, est_payout, filed_at, fee_percent, settlement_id")
        .eq("id", claimId)
        .maybeSingle();

      let settlement = null;
      if (claim?.settlement_id) {
        const { data: s } = await admin.from("settlements").select("name, company, breach_year, payout_min, payout_max, deadline, claim_deadline, administrator_name").eq("id", claim.settlement_id).maybeSingle();
        settlement = s;
      }

      // Generate signed URL for the packet HTML
      let packetSignedUrl = null;
      if (packet?.pdf_storage_path) {
        const { data: signedData } = await admin.storage
          .from("claim-packets")
          .createSignedUrl(packet.pdf_storage_path, 3600); // 1 hour
        packetSignedUrl = signedData?.signedUrl || null;
      }

      // If scope includes evidence, generate signed URLs for evidence docs
      let evidenceUrls: any[] = [];
      if (share.scope === "packet_and_evidence") {
        const { data: docs } = await admin
          .from("claim_documents")
          .select("id, file_name, file_path, doc_type, file_size, created_at")
          .eq("claim_id", claimId)
          .order("created_at", { ascending: true });

        if (docs && docs.length > 0) {
          const signedPromises = docs.map(async (doc: any) => {
            const { data: signed } = await admin.storage
              .from("claim-evidence")
              .createSignedUrl(doc.file_path, 3600);
            return {
              file_name: doc.file_name,
              doc_type: doc.doc_type,
              file_size: doc.file_size,
              created_at: doc.created_at,
              signed_url: signed?.signedUrl || null,
            };
          });
          evidenceUrls = await Promise.all(signedPromises);
        }
      }

      return new Response(JSON.stringify({
        claim: claim ? {
          id: claim.id,
          status: claim.status,
          est_payout: claim.est_payout,
          filed_at: claim.filed_at,
        } : null,
        settlement,
        packet: packet ? {
          id: packet.id,
          file_name: packet.pdf_file_name,
          generated_at: packet.generated_at,
          signed_url: packetSignedUrl,
        } : null,
        evidence: evidenceUrls,
        scope: share.scope,
        expires_at: share.expires_at,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
