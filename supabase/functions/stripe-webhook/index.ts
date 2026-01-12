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

// Send SMS via Bird API
async function sendCelebrationSMS(phone: string, userName: string | null): Promise<boolean> {
  const birdAccessKey = Deno.env.get('BIRD_ACCESS_KEY');
  const birdWorkspaceId = Deno.env.get('BIRD_WORKSPACE_ID');
  const birdChannelId = Deno.env.get('BIRD_CHANNEL_ID');

  if (!birdAccessKey || !birdWorkspaceId || !birdChannelId) {
    logStep("WARNING: Bird SMS not configured, skipping celebration SMS");
    return false;
  }

  // Skip app device tokens (push notification users - handled differently)
  if (phone.startsWith('app_device_')) {
    logStep("Skipping SMS for app user", { phone });
    // For app users, we could send a push notification instead
    // For now, just skip - they'll get the confirmation in-app
    return true;
  }

  const name = userName || 'bestie';
  const messages = [
    `YOOO ${name} you actually did it!! 🔥`,
    `ok we're locked in now. i'm officially ur accountability partner and i'm not letting you slack`,
    `let's gooo - text me whenever you're ready to crush your goals!`
  ];

  try {
    const response = await fetch(
      `https://api.bird.com/workspaces/${birdWorkspaceId}/channels/${birdChannelId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${birdAccessKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiver: { contacts: [{ identifierValue: phone }] },
          body: { type: 'text', text: { text: messages.join('\n\n') } },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logStep("ERROR: Failed to send celebration SMS", { status: response.status, error: errorText });
      return false;
    }

    logStep("SUCCESS: Sent celebration SMS", { phone: phone.slice(-4) });
    return true;
  } catch (error) {
    logStep("ERROR: Exception sending SMS", { error: error instanceof Error ? error.message : error });
    return false;
  }
}

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

        let targetUserId = userId;
        let targetUser: { id: string; phone: string; name: string | null } | null = null;

        // Try to find user by metadata first, then by customer ID
        if (!targetUserId) {
          logStep("No billie_user_id in metadata, trying customer lookup");
          const { data: userByCustomer } = await supabase
            .from('billie_users')
            .select('id, phone, name')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          
          if (userByCustomer) {
            targetUserId = userByCustomer.id;
            targetUser = userByCustomer;
            logStep("Found user by customer ID", { foundUserId: userByCustomer.id });
          }
        } else {
          // Fetch user data for SMS
          const { data: userData } = await supabase
            .from('billie_users')
            .select('id, phone, name')
            .eq('id', targetUserId)
            .maybeSingle();
          if (userData) targetUser = userData;
        }

        if (!targetUserId) {
          logStep("WARNING: Could not find user for checkout session");
          break;
        }

        // Get subscription details
        let endDate: Date | null = null;
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
              endDate = new Date(endTimestamp * 1000);
            }
          } catch (subError) {
            logStep("ERROR: Failed to retrieve subscription", { error: subError });
          }
        }

        // Update user subscription status
        const updateData: Record<string, any> = {
          subscription_status: 'active',
          stripe_customer_id: customerId,
        };
        if (endDate) {
          updateData.subscription_end = endDate.toISOString();
        }

        const { error: updateError } = await supabase
          .from('billie_users')
          .update(updateData)
          .eq('id', targetUserId);

        if (updateError) {
          logStep("ERROR: Failed to update user", { userId: targetUserId, error: updateError });
        } else {
          logStep("SUCCESS: User subscription activated", { 
            userId: targetUserId, 
            until: endDate?.toISOString() || 'no end date' 
          });

          // Send celebration SMS!
          if (targetUser) {
            await sendCelebrationSMS(targetUser.phone, targetUser.name);
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
          const endTimestamp = subscription.current_period_end;
          
          // Validate timestamp before creating date
          if (!endTimestamp || isNaN(endTimestamp)) {
            logStep("ERROR: Invalid period end timestamp", { endTimestamp });
            break;
          }
          
          const endDate = new Date(endTimestamp * 1000);

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
        let currentUser: { subscription_status: string | null; subscription_end: string | null } | null = null;
        
        if (!targetUserId) {
          const { data: userByCustomer } = await supabase
            .from('billie_users')
            .select('id, subscription_status, subscription_end')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          
          if (userByCustomer) {
            targetUserId = userByCustomer.id;
            currentUser = userByCustomer;
          }
        } else {
          const { data: userData } = await supabase
            .from('billie_users')
            .select('subscription_status, subscription_end')
            .eq('id', targetUserId)
            .maybeSingle();
          if (userData) currentUser = userData;
        }

        if (targetUserId && currentUser) {
          // IMPORTANT: Only cancel if the subscription isn't currently active with future end date
          // This prevents stale deletion events from overwriting new subscriptions
          const now = new Date();
          const subEnd = currentUser.subscription_end ? new Date(currentUser.subscription_end) : null;
          
          if (currentUser.subscription_status === 'active' && subEnd && subEnd > now) {
            logStep("SKIPPING: User has active subscription with future end date, ignoring stale deletion event", {
              targetUserId,
              currentStatus: currentUser.subscription_status,
              subscriptionEnd: currentUser.subscription_end
            });
            break;
          }

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