import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hashKey(raw: string): Promise<string> {
  const enc = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function authenticateRequest(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return { error: "Missing x-api-key header", status: 401 };

  const keyHash = await hashKey(apiKey);
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: keyData } = await sb
    .from("api_keys")
    .select("id, partner_id, rate_limit, scopes, status")
    .eq("key_hash", keyHash)
    .eq("status", "active")
    .maybeSingle();

  if (!keyData) return { error: "Invalid or expired API key", status: 401 };

  // Rate limit check
  const { data: usage } = await sb
    .from("api_usage_logs")
    .select("request_count")
    .eq("api_key_id", keyData.id)
    .gte("created_at", new Date(Date.now() - 3600000).toISOString());

  const totalReqs = (usage || []).reduce((sum: number, u: any) => sum + (u.request_count || 0), 0);
  if (totalReqs >= keyData.rate_limit) {
    return { error: "Rate limit exceeded", status: 429 };
  }

  // Update last_used_at
  await sb.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyData.id);

  return { keyData, sb };
}

async function logUsage(sb: any, keyId: string, endpoint: string, method: string, statusCode: number, startTime: number) {
  await sb.from("api_usage_logs").insert({
    api_key_id: keyId,
    endpoint,
    method,
    status_code: statusCode,
    response_time_ms: Date.now() - startTime,
  });
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Settlement Intelligence ───
async function handleSettlements(sb: any, url: URL) {
  const id = url.searchParams.get("id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  if (id) {
    const { data, error } = await sb
      .from("settlements")
      .select("id, name, company, breach_year, claim_deadline, deadline, payout_min, payout_max, status, verification_status, verified, description, eligibility_summary, claim_url, category, tags, jurisdiction, administrator_name")
      .eq("id", id)
      .eq("status", "open")
      .maybeSingle();

    if (error || !data) return json({ error: "Settlement not found" }, 404);
    return json({ settlement: data });
  }

  const { data, error, count } = await sb
    .from("settlements")
    .select("id, name, company, breach_year, claim_deadline, deadline, payout_min, payout_max, status, verification_status, verified, category, tags", { count: "exact" })
    .in("status", ["open", "verified"])
    .order("claim_deadline", { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  return json({ settlements: data || [], total: count, limit, offset });
}

// ─── Exposure + Eligibility ───
async function handleExposureCheck(sb: any, body: any) {
  const email = (body.email || "").trim().toLowerCase();
  if (!email) return json({ error: "email is required" }, 400);

  // Get matching breaches from catalog by checking if the email domain matches known breach companies
  const { data: settlements } = await sb
    .from("settlements")
    .select("id, name, company, breach_year, payout_min, payout_max, claim_deadline, status, verified")
    .in("status", ["open", "verified"])
    .order("payout_max", { ascending: false });

  // Simple domain-based matching + return all verified settlements as potential matches
  const emailDomain = email.split("@")[1] || "";
  const matches = (settlements || []).map((s: any) => {
    let confidence = 40; // Base confidence for open settlement
    if (s.verified) confidence += 20;
    if (emailDomain && s.company && emailDomain.toLowerCase().includes(s.company.toLowerCase().split(" ")[0])) {
      confidence += 30; // Domain match bonus
    }
    const payoutEstimate = s.payout_min && s.payout_max ? Math.round((s.payout_min + s.payout_max) / 2) : null;
    return {
      settlement_id: s.id,
      settlement: s.name,
      company: s.company,
      confidence: Math.min(confidence, 100),
      payout_estimate: payoutEstimate,
      claim_deadline: s.claim_deadline,
    };
  }).filter((m: any) => m.confidence >= 40);

  return json({ matches, checked_at: new Date().toISOString() });
}

// ─── Claims Intake ───
async function handleClaimsIntake(sb: any, body: any, partnerId: string) {
  const { user, settlement_id } = body;
  if (!user?.email || !settlement_id) {
    return json({ error: "user.email and settlement_id are required" }, 400);
  }

  // Validate settlement exists
  const { data: settlement } = await sb
    .from("settlements")
    .select("id, name, company")
    .eq("id", settlement_id)
    .maybeSingle();

  if (!settlement) return json({ error: "Settlement not found" }, 404);

  // Log the intake
  const { data: log } = await sb.from("partner_intake_logs").insert({
    partner_id: partnerId,
    email: user.email,
    full_name: user.name || null,
    intake_type: "api_claim",
    breach_company: settlement.company,
    notes: body.notes || null,
    meta: { source: "enterprise_api", settlement_id },
  }).select("id").single();

  return json({
    intake_id: log?.id,
    settlement: settlement.name,
    status: "received",
    message: "Claim intake received and queued for processing",
  }, 201);
}

// ─── Main Handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/enterprise-api\/?/, "").replace(/^\//, "");

  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return json({ error: auth.error }, auth.status);
  }

  const { keyData, sb } = auth;
  let response: Response;

  try {
    switch (true) {
      // GET /settlements or /settlements?id=xxx
      case path.startsWith("settlements") && req.method === "GET": {
        if (!keyData.scopes.includes("settlements")) {
          response = json({ error: "Scope 'settlements' not authorized" }, 403);
          break;
        }
        response = await handleSettlements(sb, url);
        break;
      }

      // POST /exposure/check
      case path === "exposure/check" && req.method === "POST": {
        if (!keyData.scopes.includes("exposure")) {
          response = json({ error: "Scope 'exposure' not authorized" }, 403);
          break;
        }
        const body = await req.json();
        response = await handleExposureCheck(sb, body);
        break;
      }

      // POST /claims/intake
      case path === "claims/intake" && req.method === "POST": {
        if (!keyData.scopes.includes("claims_intake")) {
          response = json({ error: "Scope 'claims_intake' not authorized" }, 403);
          break;
        }
        const body = await req.json();
        response = await handleClaimsIntake(sb, body, keyData.partner_id);
        break;
      }

      default:
        response = json({
          error: "Not found",
          available_endpoints: [
            "GET /settlements",
            "GET /settlements?id={id}",
            "POST /exposure/check",
            "POST /claims/intake",
          ],
        }, 404);
    }
  } catch (e) {
    console.error("Enterprise API error:", e);
    response = json({ error: "Internal server error" }, 500);
  }

  // Log usage
  await logUsage(sb, keyData.id, path, req.method, response.status, startTime);

  return response;
});
