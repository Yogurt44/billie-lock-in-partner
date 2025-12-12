import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { email, action, code } = body;

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "send") {
      // Generate 6-digit code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Delete any existing unused codes for this email
      await supabase
        .from("email_otp_codes")
        .delete()
        .eq("email", normalizedEmail)
        .eq("used", false);

      // Insert new code
      const { error: insertError } = await supabase
        .from("email_otp_codes")
        .insert({
          email: normalizedEmail,
          code: otpCode,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Failed to insert OTP code:", insertError);
        throw new Error("Failed to create verification code");
      }

      // Send email via Resend
      const { error: emailError } = await resend.emails.send({
        from: "BILLIE <onboarding@resend.dev>",
        to: [normalizedEmail],
        subject: "Your BILLIE login code",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333; margin-bottom: 20px;">hey bestie 👋</h2>
            <p style="color: #666; margin-bottom: 20px;">here's your login code:</p>
            <div style="background: #f4f4f4; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${otpCode}</span>
            </div>
            <p style="color: #999; font-size: 14px;">expires in 10 minutes. if you didn't request this, just ignore it.</p>
            <p style="color: #999; font-size: 14px; margin-top: 20px;">- BILLIE 💙</p>
          </div>
        `,
      });

      if (emailError) {
        console.error("Failed to send email:", emailError);
        throw new Error("Failed to send verification email");
      }

      console.log(`[OTP] Sent code to ${normalizedEmail.substring(0, 3)}***`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "verify") {
      if (!code || typeof code !== "string") {
        return new Response(JSON.stringify({ error: "Code is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the code
      const { data: otpRecord, error: fetchError } = await supabase
        .from("email_otp_codes")
        .select("*")
        .eq("email", normalizedEmail)
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (fetchError) {
        console.error("Failed to fetch OTP code:", fetchError);
        throw new Error("Failed to verify code");
      }

      if (!otpRecord) {
        return new Response(JSON.stringify({ error: "Invalid or expired code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark code as used
      await supabase
        .from("email_otp_codes")
        .update({ used: true })
        .eq("id", otpRecord.id);

      // Check if user exists in billie_users, create if not
      const { data: existingUser } = await supabase
        .from("billie_users")
        .select("id")
        .eq("phone", normalizedEmail)
        .maybeSingle();

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
      } else {
        // Create new user
        const { data: newUser, error: createError } = await supabase
          .from("billie_users")
          .insert({ phone: normalizedEmail })
          .select("id")
          .single();

        if (createError) {
          console.error("Failed to create user:", createError);
          throw new Error("Failed to create user");
        }
        userId = newUser.id;
      }

      console.log(`[OTP] Verified code for ${normalizedEmail.substring(0, 3)}***`);

      return new Response(JSON.stringify({ success: true, userId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in send-otp function:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
