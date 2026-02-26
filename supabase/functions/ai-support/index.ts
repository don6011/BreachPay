import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { message, ticket_id } = await req.json();
    if (!message) throw new Error("message required");

    // Gather user context
    const [claimsRes, settlementsRes, profileRes] = await Promise.all([
      supabase.from("claims").select("id, status, est_payout, settlement_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
      supabase.from("settlement_matches").select("id, settlement_id, confidence_score, payout_estimate, settlements(name, company, deadline)").eq("user_id", user.id).limit(10),
      supabase.from("user_profiles").select("full_name, plan").eq("user_id", user.id).single(),
    ]);

    const claimsSummary = (claimsRes.data || []).map(c => `Claim ${c.id.slice(0,8)}: status=${c.status}, est_payout=$${c.est_payout || 0}`).join("\n");
    const matchesSummary = (settlementsRes.data || []).map((m: any) => `Match: ${m.settlements?.name || 'Unknown'} (${m.settlements?.company}), confidence=${m.confidence_score}%, deadline=${m.settlements?.deadline || 'N/A'}`).join("\n");

    const systemPrompt = `You are the BreachPay AI Support Assistant. You help users with questions about their data breach claims, settlements, payouts, and account.

User context:
- Name: ${profileRes.data?.full_name || "Unknown"}
- Plan: ${profileRes.data?.plan || "free"}

Active claims:
${claimsSummary || "No active claims"}

Settlement matches:
${matchesSummary || "No matches found"}

Guidelines:
- Be helpful, concise, and empathetic
- Answer claim status questions using the context above
- For deadline questions, reference the settlement data
- For document requirements, explain what's typically needed (ID, proof of breach notice, proof of address)
- For payout timing, explain that payouts depend on settlement administrator processing (typically 2-6 months after approval)
- If you cannot confidently answer, set needs_escalation to true
- Never make up claim statuses or payout amounts not in the context`;

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
          { role: "user", content: message },
        ],
        tools: [{
          type: "function",
          function: {
            name: "respond_to_user",
            description: "Respond to the user's support question",
            parameters: {
              type: "object",
              properties: {
                response: { type: "string", description: "The helpful response to show the user" },
                needs_escalation: { type: "boolean", description: "Whether this needs human review" },
                category: { type: "string", enum: ["claim_status", "deadline", "documents", "payout", "account", "technical", "other"] },
                suggested_priority: { type: "integer", minimum: 1, maximum: 100 },
              },
              required: ["response", "needs_escalation", "category", "suggested_priority"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "respond_to_user" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call response");

    const result = JSON.parse(toolCall.function.arguments);

    // Create or update ticket
    let ticketId = ticket_id;
    if (!ticketId) {
      const { data: ticket, error: ticketErr } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          subject: message.slice(0, 100),
          message,
          category: result.category,
          priority: result.suggested_priority,
          ai_response: result.response,
          ai_resolved: !result.needs_escalation,
          status: result.needs_escalation ? "escalated" : "ai_resolved",
          resolved_at: result.needs_escalation ? null : new Date().toISOString(),
        })
        .select("id")
        .single();
      if (ticketErr) throw ticketErr;
      ticketId = ticket.id;
    }

    // Add messages to thread
    await supabase.from("support_ticket_messages").insert([
      { ticket_id: ticketId, sender_type: "user", message },
      { ticket_id: ticketId, sender_type: "ai", message: result.response },
    ]);

    return new Response(JSON.stringify({
      ticket_id: ticketId,
      response: result.response,
      needs_escalation: result.needs_escalation,
      category: result.category,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-support error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
