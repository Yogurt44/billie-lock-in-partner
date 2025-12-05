import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stripe price IDs
const PRICES = {
  monthly: "price_1SaiirAQ7IuLqpQm58jZBL7e", // $9.99/month
  annual: "price_1SaijMAQ7IuLqpQmGZsiKGZX",  // $79.99/year
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only accept phone - lookup user_id from database to prevent spoofing
    const { phone, plan = "monthly" } = await req.json();
    
    if (!phone) {
      throw new Error("phone is required");
    }

    // Validate phone format (basic E.164 validation)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone)) {
      throw new Error("Invalid phone format");
    }

    console.log(`[Checkout] Creating session for phone (masked), plan: ${plan}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // SECURITY: Look up user by phone instead of accepting user_id from request
    // This prevents attackers from creating checkout sessions for arbitrary users
    const { data: user, error: userError } = await supabase
      .from('billie_users')
      .select('id, stripe_customer_id')
      .eq('phone', phone)
      .single();

    if (userError || !user) {
      console.error("[Checkout] User not found for phone");
      throw new Error("User not found");
    }

    const user_id = user.id;
    let customerId = user.stripe_customer_id;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // If no customer, create one
    if (!customerId) {
      const customer = await stripe.customers.create({
        phone: phone,
        metadata: {
          billie_user_id: user_id,
        },
      });
      customerId = customer.id;

      // Save customer ID to user record
      await supabase
        .from('billie_users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user_id);

      console.log(`[Checkout] Created Stripe customer`);
    }

    const priceId = plan === "annual" ? PRICES.annual : PRICES.monthly;
    const origin = req.headers.get("origin") || "https://vqfcnpmvzvukdfoitzue.lovableproject.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      metadata: {
        billie_user_id: user_id,
      },
      subscription_data: {
        metadata: {
          billie_user_id: user_id,
        },
      },
    });

    console.log(`[Checkout] Session created`);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[Checkout] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
