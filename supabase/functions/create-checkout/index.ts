import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

// CORS restricted to production domain
const allowedOrigins = ['https://trybillie.app', 'https://www.trybillie.app'];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

// Stripe price IDs
const PRICES: Record<string, string> = {
  monthly: "price_1SaiirAQ7IuLqpQm58jZBL7e", // $9.99/month
  annual: "price_1SaijMAQ7IuLqpQmGZsiKGZX",  // $79.99/year
};

// Valid plan values
const VALID_PLANS = ['monthly', 'annual'];

// Verify HMAC-signed token
function verifyToken(token: string): { userId: string; phone: string; valid: boolean } {
  try {
    const tokenSecret = Deno.env.get('TWILIO_AUTH_TOKEN');
    if (!tokenSecret) {
      console.error('[Checkout] TOKEN_SECRET not configured');
      return { userId: '', phone: '', valid: false };
    }
    const decoded = atob(token);
    const parts = decoded.split(':');
    
    if (parts.length !== 4) {
      console.error('[Checkout] Invalid token format');
      return { userId: '', phone: '', valid: false };
    }
    
    const [userId, phone, expiresAt, providedSignature] = parts;
    
    // Check expiration
    const expiry = parseInt(expiresAt, 10);
    if (Date.now() > expiry) {
      console.error('[Checkout] Token expired');
      return { userId: '', phone: '', valid: false };
    }
    
    // Verify signature
    const payload = `${userId}:${phone}:${expiresAt}`;
    const hmac = createHmac("sha256", tokenSecret);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");
    
    if (providedSignature !== expectedSignature) {
      console.error('[Checkout] Invalid token signature');
      return { userId: '', phone: '', valid: false };
    }
    
    return { userId, phone, valid: true };
  } catch (error) {
    console.error('[Checkout] Token verification error:', error);
    return { userId: '', phone: '', valid: false };
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { token, plan = "monthly" } = body;
    
    // Input validation
    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: "Unable to process request" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Validate plan against allowed values
    if (!VALID_PLANS.includes(plan)) {
      return new Response(JSON.stringify({ error: "Unable to process request" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Verify the signed token
    const { userId: user_id, phone, valid } = verifyToken(token);
    
    if (!valid || !user_id || !phone) {
      return new Response(JSON.stringify({ error: "Unable to process request" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`[Checkout] Creating session for verified token, plan: ${plan}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify user exists and matches token data
    const { data: user, error: userError } = await supabase
      .from('billie_users')
      .select('id, stripe_customer_id')
      .eq('id', user_id)
      .eq('phone', phone)
      .maybeSingle();

    if (userError || !user) {
      console.error("[Checkout] User verification failed");
      return new Response(JSON.stringify({ error: "Unable to process request" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    let customerId = user.stripe_customer_id;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // If no customer, create one
    if (!customerId) {
      // Only pass phone if it's a real phone number (not a device ID)
      const isRealPhone = phone && !phone.startsWith('app_') && phone.length <= 20;
      
      const customer = await stripe.customers.create({
        ...(isRealPhone ? { phone: phone } : {}),
        metadata: {
          billie_user_id: user_id,
          billie_phone: phone,
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

    const priceId = PRICES[plan];
    const origin = req.headers.get("origin") || "https://trybillie.app";

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
    return new Response(JSON.stringify({ error: "Unable to process request" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
