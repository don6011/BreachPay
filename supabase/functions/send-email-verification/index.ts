import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, email, identifier_id, code } = await req.json();

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- SEND verification code ---
    if (action === "send") {
      if (!email || typeof email !== "string") {
        return new Response(
          JSON.stringify({ error: "Valid email required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const trimmedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail) || trimmedEmail.length > 255) {
        return new Response(
          JSON.stringify({ error: "Invalid email format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check user's plan for limit
      const { data: profile } = await adminClient
        .from("user_profiles")
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle();

      const isPremium = profile?.plan === "premium";
      const maxEmails = isPremium ? 5 : 1;

      // Count existing monitored emails
      const { count } = await adminClient
        .from("monitored_identifiers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("type", "email");

      if ((count ?? 0) >= maxEmails) {
        return new Response(
          JSON.stringify({
            error: isPremium
              ? "Maximum 5 monitored emails reached"
              : "Free plan allows 1 email. Upgrade to Premium for up to 5.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check duplicate
      const emailHash = await hashEmail(trimmedEmail);
      const { data: existing } = await adminClient
        .from("monitored_identifiers")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "email")
        .eq("value_hash", emailHash)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: "This email is already being monitored" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate 6-digit code
      const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

      // Insert identifier record
      const last4 = trimmedEmail.length > 4 ? trimmedEmail.slice(-4) : trimmedEmail;
      const { data: inserted, error: insertErr } = await adminClient
        .from("monitored_identifiers")
        .insert({
          user_id: user.id,
          type: "email",
          value_hash: emailHash,
          value_last4: last4,
          display_label: trimmedEmail,
          verified: false,
          verification_code: verificationCode,
          verification_expires_at: expiresAt,
          is_active: false,
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error("Insert error:", insertErr);
        return new Response(
          JSON.stringify({ error: "Failed to add email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send verification email via Resend
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@breachpay.com";

      if (resendKey) {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [trimmedEmail],
            subject: "BreachPay - Verify Your Email",
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #0f172a;">Verify your email for BreachPay</h2>
                <p style="color: #64748b;">Enter this code in BreachPay to verify <strong>${trimmedEmail}</strong>:</p>
                <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f172a;">${verificationCode}</span>
                </div>
                <p style="color: #94a3b8; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
              </div>
            `,
          }),
        });

        if (!emailRes.ok) {
          console.error("Resend error:", await emailRes.text());
        }
      } else {
        console.warn("RESEND_API_KEY not set, verification code:", verificationCode);
      }

      return new Response(
        JSON.stringify({ success: true, identifier_id: inserted.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- VERIFY code ---
    if (action === "verify") {
      if (!identifier_id || !code) {
        return new Response(
          JSON.stringify({ error: "Identifier ID and code required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: record } = await adminClient
        .from("monitored_identifiers")
        .select("*")
        .eq("id", identifier_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!record) {
        return new Response(
          JSON.stringify({ error: "Record not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (record.verified) {
        return new Response(
          JSON.stringify({ success: true, already_verified: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (
        !record.verification_code ||
        record.verification_code !== String(code).trim()
      ) {
        return new Response(
          JSON.stringify({ error: "Invalid verification code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (
        record.verification_expires_at &&
        new Date(record.verification_expires_at) < new Date()
      ) {
        return new Response(
          JSON.stringify({ error: "Verification code expired. Please resend." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark as verified
      await adminClient
        .from("monitored_identifiers")
        .update({
          verified: true,
          is_active: true,
          verification_code: null,
          verification_expires_at: null,
        })
        .eq("id", identifier_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- RESEND code ---
    if (action === "resend") {
      if (!identifier_id) {
        return new Response(
          JSON.stringify({ error: "Identifier ID required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: record } = await adminClient
        .from("monitored_identifiers")
        .select("*")
        .eq("id", identifier_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!record || record.verified) {
        return new Response(
          JSON.stringify({ error: "Not found or already verified" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newCode = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      await adminClient
        .from("monitored_identifiers")
        .update({
          verification_code: newCode,
          verification_expires_at: expiresAt,
        })
        .eq("id", identifier_id);

      // Send email
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@breachpay.com";
      const targetEmail = record.display_label;

      if (resendKey && targetEmail) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [targetEmail],
            subject: "BreachPay - Your New Verification Code",
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #0f172a;">New verification code</h2>
                <p style="color: #64748b;">Enter this code in BreachPay to verify <strong>${targetEmail}</strong>:</p>
                <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f172a;">${newCode}</span>
                </div>
                <p style="color: #94a3b8; font-size: 13px;">This code expires in 15 minutes.</p>
              </div>
            `,
          }),
        });
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
