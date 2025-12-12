import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[Webhook] ${step}${detailsStr}`);
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
      logStep("ERROR: STRIPE_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!signature) {
      logStep("ERROR: Missing stripe-signature header");
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Signature verified successfully");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      logStep("ERROR: Signature verification failed", { message: errMsg });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    logStep(`Event received: ${event.type}`, { eventId: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.billie_user_id;
        const customerId = session.customer as string;

        logStep("Processing checkout.session.completed", { 
          userId, 
          customerId,
          subscriptionId: session.subscription,
          metadata: session.metadata 
        });

        if (!userId) {
          // Try to find user by customer ID as fallback
          logStep("No billie_user_id in metadata, trying customer lookup");
          const { data: userByCustomer } = await supabase
            .from('billie_users')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          
          if (userByCustomer) {
            logStep("Found user by customer ID", { foundUserId: userByCustomer.id });
            // Update subscription status
            if (session.subscription) {
              const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
              const endDate = new Date(subscription.current_period_end * 1000);
              
              const { error: updateError } = await supabase
                .from('billie_users')
                .update({
                  subscription_status: 'active',
                  subscription_end: endDate.toISOString(),
                })
                .eq('id', userByCustomer.id);
              
              if (updateError) {
                logStep("ERROR: Failed to update user by customer ID", { error: updateError });
              } else {
                logStep("Updated subscription via customer lookup", { userId: userByCustomer.id });
              }
            }
          } else {
            logStep("WARNING: Could not find user for checkout session");
          }
          break;
        }

        // Get subscription details
        if (session.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
            const endTimestamp = subscription.current_period_end;
            
            logStep("Retrieved subscription details", { 
              subscriptionId: subscription.id,
              status: subscription.status,
              endTimestamp 
            });
            
            if (endTimestamp && !isNaN(endTimestamp)) {
              const endDate = new Date(endTimestamp * 1000);
              
              const { error: updateError } = await supabase
                .from('billie_users')
                .update({
                  subscription_status: 'active',
                  subscription_end: endDate.toISOString(),
                  stripe_customer_id: customerId,
                })
                .eq('id', userId);

              if (updateError) {
                logStep("ERROR: Failed to update user", { userId, error: updateError });
              } else {
                logStep("SUCCESS: User subscription activated", { userId, until: endDate.toISOString() });
              }
            } else {
              logStep("ERROR: Invalid period end timestamp", { endTimestamp });
            }
          } catch (subError) {
            logStep("ERROR: Failed to retrieve subscription", { error: subError });
          }
        } else {
          // One-time payment or subscription not available yet - just mark as active
          logStep("No subscription ID, marking user as active");
          const { error: updateError } = await supabase
            .from('billie_users')
            .update({
              subscription_status: 'active',
              stripe_customer_id: customerId,
            })
            .eq('id', userId);
          
          if (updateError) {
            logStep("ERROR: Failed to update user", { userId, error: updateError });
          } else {
            logStep("SUCCESS: User marked active (no subscription)", { userId });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.billie_user_id;
        const customerId = subscription.customer as string;

        logStep("Processing customer.subscription.updated", { 
          userId, 
          customerId,
          status: subscription.status 
        });

        // Try to find user by userId or customerId
        let targetUserId = userId;
        if (!targetUserId) {
          const { data: userByCustomer } = await supabase
            .from('billie_users')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          
          if (userByCustomer) {
            targetUserId = userByCustomer.id;
            logStep("Found user by customer ID", { targetUserId });
          }
        }

        if (targetUserId) {
          const status = subscription.status === 'active' ? 'active' : 'inactive';
          const endDate = new Date(subscription.current_period_end * 1000);

          const { error: updateError } = await supabase
            .from('billie_users')
            .update({
              subscription_status: status,
              subscription_end: endDate.toISOString(),
            })
            .eq('id', targetUserId);

          if (updateError) {
            logStep("ERROR: Failed to update user", { targetUserId, error: updateError });
          } else {
            logStep("SUCCESS: Subscription updated", { targetUserId, status });
          }
        } else {
          logStep("WARNING: Could not find user for subscription update");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.billie_user_id;
        const customerId = subscription.customer as string;

        logStep("Processing customer.subscription.deleted", { userId, customerId });

        let targetUserId = userId;
        if (!targetUserId) {
          const { data: userByCustomer } = await supabase
            .from('billie_users')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          
          if (userByCustomer) {
            targetUserId = userByCustomer.id;
          }
        }

        if (targetUserId) {
          const { error: updateError } = await supabase
            .from('billie_users')
            .update({ subscription_status: 'canceled' })
            .eq('id', targetUserId);

          if (updateError) {
            logStep("ERROR: Failed to update user", { targetUserId, error: updateError });
          } else {
            logStep("SUCCESS: Subscription canceled", { targetUserId });
          }
        } else {
          logStep("WARNING: Could not find user for subscription deletion");
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        logStep("Processing invoice.payment_failed", { customerId });

        // Find user by Stripe customer ID
        const { data: user } = await supabase
          .from('billie_users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (user) {
          const { error: updateError } = await supabase
            .from('billie_users')
            .update({ subscription_status: 'past_due' })
            .eq('id', user.id);

          if (updateError) {
            logStep("ERROR: Failed to update user", { userId: user.id, error: updateError });
          } else {
            logStep("SUCCESS: User marked as past_due", { userId: user.id });
          }
        } else {
          logStep("WARNING: Could not find user for payment failure");
        }
        break;
      }

      default:
        logStep(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    logStep("ERROR: Unhandled exception", { error: error instanceof Error ? error.message : error });
    return new Response(JSON.stringify({ error: "Internal error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});