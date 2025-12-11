import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const body = await req.text();

    let event: Stripe.Event;

    // SECURITY: Always require webhook secret and signature verification
    if (!webhookSecret) {
      console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!signature) {
      console.error("[Webhook] Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("[Webhook] Signature verification failed:", errMsg);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log(`[Webhook] Event received: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.billie_user_id;
        const phone = session.metadata?.phone;

        if (userId) {
          console.log(`[Webhook] Checkout completed for user ${userId}`);
          
          // Get subscription details
          if (session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
            const endDate = new Date(subscription.current_period_end * 1000);

            await supabase
              .from('billie_users')
              .update({
                subscription_status: 'active',
                subscription_end: endDate.toISOString(),
                stripe_customer_id: session.customer as string,
              })
              .eq('id', userId);

            console.log(`[Webhook] User ${userId} subscription activated until ${endDate}`);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.billie_user_id;

        if (userId) {
          const status = subscription.status === 'active' ? 'active' : 'inactive';
          const endDate = new Date(subscription.current_period_end * 1000);

          await supabase
            .from('billie_users')
            .update({
              subscription_status: status,
              subscription_end: endDate.toISOString(),
            })
            .eq('id', userId);

          console.log(`[Webhook] User ${userId} subscription updated: ${status}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.billie_user_id;

        if (userId) {
          await supabase
            .from('billie_users')
            .update({
              subscription_status: 'canceled',
            })
            .eq('id', userId);

          console.log(`[Webhook] User ${userId} subscription canceled`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Find user by Stripe customer ID
        const { data: user } = await supabase
          .from('billie_users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (user) {
          await supabase
            .from('billie_users')
            .update({ subscription_status: 'past_due' })
            .eq('id', user.id);

          console.log(`[Webhook] User ${user.id} payment failed`);
        }
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
