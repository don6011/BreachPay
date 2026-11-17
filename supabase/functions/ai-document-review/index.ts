import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Access control ──────────────────────────────────────────────────────────
// verify_jwt is off for this function, so it must authenticate callers itself.
// Allowed: (1) scheduled jobs sending the x-cron-secret header that matches the
// CRON_SECRET function secret, (2) a signed-in admin user.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

async function requireAdminOrCron(req: Request): Promise<Response | null> {
  const deny = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");
  if (cronSecret && providedSecret && timingSafeEqual(providedSecret, cronSecret)) {
    return null;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return deny(401, "Unauthorized");

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return deny(500, "Missing env");

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return deny(401, "Unauthorized");

  const { data: roleRow } = await createClient(url, serviceKey)
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return deny(403, "Forbidden");

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const denied = await requireAdminOrCron(req);
  if (denied) return denied;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { document_id } = await req.json();
    if (!document_id) throw new Error("document_id required");

    // Fetch document metadata
    const { data: doc, error: docErr } = await supabase
      .from("claim_documents")
      .select("id, file_name, file_type, doc_type, file_size, claim_id, user_id, mime_type")
      .eq("id", document_id)
      .single();

    if (docErr || !doc) throw new Error("Document not found");

    // Fetch claim context
    const { data: claim } = await supabase
      .from("claims")
      .select("id, settlement_id, user_id, status")
      .eq("id", doc.claim_id)
      .single();

    // Fetch user profile for name matching
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, email")
      .eq("user_id", doc.user_id)
      .single();

    // Build AI prompt
    const systemPrompt = `You are a document review AI for a data breach settlement claims platform called BreachPay. 
You analyze claim documents for authenticity, completeness, and relevance.

Analyze the following document metadata and determine:
1. What type of document this appears to be (breach_notice, id_document, proof_of_address, receipt, correspondence, other)
2. A confidence score (0-100) for your classification
3. Whether there are any fraud indicators (true/false)
4. If fraud is suspected, list specific reasons
5. A completeness score (0-100) - does this document seem sufficient for its purpose?
6. Name match score (0-100) - based on file name patterns, does this seem to match the claimant?

Respond using the analyze_document tool.`;

    const userPrompt = `Document metadata:
- File name: ${doc.file_name}
- File type: ${doc.file_type || doc.mime_type || "unknown"}
- Declared doc type: ${doc.doc_type}
- File size: ${doc.file_size || "unknown"} bytes
- Claim ID: ${doc.claim_id}
- Claimant name: ${profile?.full_name || "unknown"}
- Claimant email: ${profile?.email || "unknown"}
- Claim status: ${claim?.status || "unknown"}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_document",
            description: "Return document analysis results",
            parameters: {
              type: "object",
              properties: {
                doc_type_detected: { type: "string", enum: ["breach_notice", "id_document", "proof_of_address", "receipt", "correspondence", "other"] },
                confidence_score: { type: "integer", minimum: 0, maximum: 100 },
                fraud_flag: { type: "boolean" },
                fraud_reasons: { type: "array", items: { type: "string" } },
                completeness_score: { type: "integer", minimum: 0, maximum: 100 },
                name_match_score: { type: "integer", minimum: 0, maximum: 100 },
              },
              required: ["doc_type_detected", "confidence_score", "fraud_flag", "fraud_reasons", "completeness_score", "name_match_score"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "analyze_document" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const analysis = JSON.parse(toolCall.function.arguments);

    // Store analysis
    const { error: insertErr } = await supabase
      .from("document_ai_analysis")
      .insert({
        document_id,
        doc_type_detected: analysis.doc_type_detected,
        confidence_score: analysis.confidence_score,
        fraud_flag: analysis.fraud_flag,
        fraud_reasons: analysis.fraud_reasons || [],
        completeness_score: analysis.completeness_score,
        name_match_score: analysis.name_match_score,
        analysis_model: "gemini-3-flash-preview",
        extracted_text: { raw_analysis: analysis },
      });

    if (insertErr) {
      console.error("Insert error:", insertErr);
      throw new Error("Failed to store analysis");
    }

    // If fraud flagged, auto-queue for review
    if (analysis.fraud_flag) {
      await supabase.from("claim_review_queue").insert({
        claim_id: doc.claim_id,
        queue_type: "doc_review",
        priority: 80,
        notes: `AI flagged document "${doc.file_name}": ${(analysis.fraud_reasons || []).join(", ")}`,
      });
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-document-review error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
