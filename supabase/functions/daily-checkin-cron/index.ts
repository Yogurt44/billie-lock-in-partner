import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Proactive conversation starters based on goals
const PROACTIVE_MESSAGES = {
  morning: [
    (name: string, goal: string) => `morning ${name}! ready to crush ${goal} today? 🔥`,
    (name: string, goal: string) => `yo ${name} wake up!! time to work on ${goal}`,
    (name: string, goal: string) => `${name}! new day new chance to lock in on ${goal}`,
    (name: string, goal: string) => `gm ${name}. what's the move for ${goal} today?`,
  ],
  midday: [
    (name: string, goal: string) => `${name} how's ${goal} going? be honest`,
    (name: string, goal: string) => `checking in ${name}... did you actually work on ${goal}?`,
    (name: string, goal: string) => `halfway through the day ${name}. ${goal} progress update?`,
    (name: string, goal: string) => `${name}! quick check - you staying locked in on ${goal}?`,
  ],
  evening: [
    (name: string, goal: string) => `${name} end of day check in. how'd ${goal} go today?`,
    (name: string, goal: string) => `${name}! did you do the thing? tell me about ${goal}`,
    (name: string, goal: string) => `day's almost over ${name}. rate your ${goal} progress 1-10`,
    (name: string, goal: string) => `${name} accountability time. ${goal} - did you show up today?`,
  ],
  followup: [
    (name: string) => `${name}? you there? don't ghost me lol`,
    (name: string) => `${name} i see you ignoring me 👀`,
    (name: string) => `hey ${name} just checking you're still alive`,
    (name: string) => `${name}!! respond or i'm assuming you're doom scrolling rn`,
  ],
};

function getRandomMessage(category: keyof typeof PROACTIVE_MESSAGES, name: string, goal?: string): string {
  const messages = PROACTIVE_MESSAGES[category];
  const randomIndex = Math.floor(Math.random() * messages.length);
  const messageFn = messages[randomIndex];
  
  if (category === 'followup') {
    return (messageFn as (name: string) => string)(name);
  }
  return (messageFn as (name: string, goal: string) => string)(name, goal || 'your goals');
}

function getUserLocalHour(now: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    });
    return parseInt(formatter.format(now), 10);
  } catch {
    // Fallback: assume EST (-5)
    return (now.getUTCHours() - 5 + 24) % 24;
  }
}

function parseTime(timeStr: string): number {
  const [hour] = timeStr.split(":").map(Number);
  return hour;
}

function shouldSendCheckIn(
  userLocalHour: number,
  frequency: string,
  morningTime: string,
  middayTime: string,
  eveningTime: string
): { shouldSend: boolean; period: 'morning' | 'midday' | 'evening' | null } {
  const morningHour = parseTime(morningTime);
  const middayHour = parseTime(middayTime);
  const eveningHour = parseTime(eveningTime);
  
  // Check if current hour matches any check-in time (within same hour window)
  if (userLocalHour === morningHour && ['once', 'twice', 'thrice'].includes(frequency)) {
    return { shouldSend: true, period: 'morning' };
  }
  if (userLocalHour === middayHour && ['twice', 'thrice'].includes(frequency)) {
    return { shouldSend: true, period: 'midday' };
  }
  if (userLocalHour === eveningHour && frequency === 'thrice') {
    return { shouldSend: true, period: 'evening' };
  }
  
  return { shouldSend: false, period: null };
}

function shouldSendFollowUp(lastNotificationAt: string | null, awaiting: boolean): boolean {
  if (!awaiting || !lastNotificationAt) return false;
  
  const lastNotification = new Date(lastNotificationAt);
  const now = new Date();
  const hoursSinceLastNotification = (now.getTime() - lastNotification.getTime()) / (1000 * 60 * 60);
  
  // Send follow-up after 2 hours of no response
  return hoursSinceLastNotification >= 2 && hoursSinceLastNotification < 4;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedSecret = req.headers.get("x-cron-secret");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    
    const hasValidAuth = authHeader && anonKey && authHeader.includes(anonKey);
    const hasValidCronSecret = cronSecret && providedSecret === cronSecret;
    
    if (!hasValidAuth && !hasValidCronSecret) {
      console.error("[CRON] Unauthorized: Invalid authorization");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }
    
    console.log("[CRON] Authorization validated successfully");
    console.log("[CRON] Smart check-in system starting...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    console.log(`[CRON] Current UTC time: ${now.toISOString()}`);

    // Get all active subscribed users with push tokens
    const { data: users, error } = await supabase
      .from("billie_users")
      .select(`
        id, name, phone, push_token, timezone, goals,
        subscription_status, subscription_end,
        morning_check_in_time, midday_check_in_time, evening_check_in_time,
        check_in_frequency, last_notification_at, awaiting_response
      `)
      .not("push_token", "is", null)
      .eq("subscription_status", "active");

    if (error) {
      console.error("[CRON] Error fetching users:", error);
      throw error;
    }

    console.log(`[CRON] Found ${users?.length || 0} users with push tokens`);

    const checkInsSent: string[] = [];
    const followUpsSent: string[] = [];

    for (const user of users || []) {
      try {
        // Check if subscription is still valid
        if (user.subscription_end && new Date(user.subscription_end) < now) {
          console.log(`[CRON] User ${user.id} subscription expired, skipping`);
          continue;
        }

        const userLocalHour = getUserLocalHour(now, user.timezone || "America/New_York");
        const name = user.name || "bestie";
        const goalText = user.goals ? user.goals.split("\n")[0] : "your goals";
        const pushToken = user.push_token;

        // Check for follow-up first (if user hasn't responded)
        if (shouldSendFollowUp(user.last_notification_at, user.awaiting_response)) {
          console.log(`[CRON] Sending follow-up to ${name} (${user.id})`);
          
          const followUpMessage = getRandomMessage('followup', name);
          await sendPushNotification(pushToken, followUpMessage);
          
          // Update notification timestamp
          await supabase
            .from("billie_users")
            .update({ last_notification_at: now.toISOString() })
            .eq("id", user.id);
          
          followUpsSent.push(user.id);
          continue; // Don't send regular check-in if we sent follow-up
        }

        // Check if it's time for a scheduled check-in
        const { shouldSend, period } = shouldSendCheckIn(
          userLocalHour,
          user.check_in_frequency || 'thrice',
          user.morning_check_in_time || '09:00',
          user.midday_check_in_time || '14:00',
          user.evening_check_in_time || '20:00'
        );

        if (shouldSend && period) {
          // Check we haven't already notified in this hour
          if (user.last_notification_at) {
            const lastNotif = new Date(user.last_notification_at);
            const hoursSinceLastNotif = (now.getTime() - lastNotif.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastNotif < 1) {
              console.log(`[CRON] Already notified ${name} recently, skipping`);
              continue;
            }
          }

          console.log(`[CRON] Sending ${period} check-in to ${name} (${user.id})`);
          
          const message = getRandomMessage(period, name, goalText);
          await sendPushNotification(pushToken, message);
          
          // Update user state
          await supabase
            .from("billie_users")
            .update({ 
              last_notification_at: now.toISOString(),
              awaiting_response: true 
            })
            .eq("id", user.id);
          
          // Also save message to conversation history for context
          await supabase
            .from("billie_messages")
            .insert({
              user_id: user.id,
              role: 'billie',
              content: message
            });
          
          checkInsSent.push(user.id);
        }

      } catch (userError) {
        console.error(`[CRON] Error processing user ${user.id}:`, userError);
      }
    }

    console.log(`[CRON] Sent ${checkInsSent.length} check-ins, ${followUpsSent.length} follow-ups`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        check_ins_sent: checkInsSent.length,
        follow_ups_sent: followUpsSent.length,
        check_in_user_ids: checkInsSent,
        follow_up_user_ids: followUpsSent
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CRON] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

// Send push notification - supports both Expo and APNs/FCM tokens
async function sendPushNotification(token: string, message: string) {
  // Expo push tokens start with "ExponentPushToken"
  if (token.startsWith("ExponentPushToken")) {
    return sendExpoPush(token, message);
  }
  
  // For Capacitor iOS (APNs) - we need FCM to relay
  // APNs tokens from Capacitor are typically hex strings or base64
  // We'll use FCM HTTP v1 API which can send to both iOS and Android
  return sendFCMPush(token, message);
}

async function sendExpoPush(token: string, message: string) {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: token,
      sound: "default",
      title: "BILLIE",
      body: message,
      data: { screen: "chat" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[CRON] Expo push error:", errorText);
    throw new Error(`Expo push failed: ${errorText}`);
  }

  console.log("[CRON] Expo push sent successfully");
}

async function sendFCMPush(token: string, message: string) {
  const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
  
  if (!fcmServerKey) {
    console.log("[CRON] FCM_SERVER_KEY not configured, using APNs direct");
    // For now, log that we would send - user needs to configure FCM
    console.log(`[CRON] Would send to APNs token: ${token.substring(0, 20)}... message: ${message}`);
    return;
  }

  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Authorization": `key=${fcmServerKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: token,
      notification: {
        title: "BILLIE",
        body: message,
        sound: "default",
      },
      data: {
        screen: "chat",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[CRON] FCM push error:", errorText);
    throw new Error(`FCM push failed: ${errorText}`);
  }

  console.log("[CRON] FCM push sent successfully");
}
