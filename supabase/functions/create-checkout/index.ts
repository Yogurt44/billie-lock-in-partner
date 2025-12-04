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
    const { user_id, phone, plan = "monthly" } = await req.json();
    
    if (!user_id || !phone) {
      throw new Error("user_id and phone are required");
    }

    console.log(`[Checkout] Creating session for user ${user_id}, plan: ${plan}`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if user already has a Stripe customer ID
    const { data: user } = await supabase
      .from('billie_users')
      .select('stripe_customer_id')
      .eq('id', user_id)
      .single();

    let customerId = user?.stripe_customer_id;

    // If no customer, create one
    if (!customerId) {
      const customer = await stripe.customers.create({
        phone: phone,
        metadata: {
          billie_user_id: user_id,
          phone: phone,
        },
      });
      customerId = customer.id;

      // Save customer ID to user record
      await supabase
        .from('billie_users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user_id);

      console.log(`[Checkout] Created Stripe customer ${customerId}`);
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
        phone: phone,
      },
      subscription_data: {
        metadata: {
          billie_user_id: user_id,
          phone: phone,
        },
      },
    });

    console.log(`[Checkout] Session created: ${session.id}`);

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
