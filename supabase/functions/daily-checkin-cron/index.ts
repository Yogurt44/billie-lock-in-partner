import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[CRON] Daily check-in reminder starting...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get current time
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    console.log(`[CRON] Current UTC time: ${currentHour}:${currentMinute}`);

    // Get all active subscribed users with push tokens
    const { data: users, error } = await supabase
      .from("billie_users")
      .select("id, name, phone, push_token, preferred_check_in_time, timezone, goals, subscription_status, subscription_end")
      .not("push_token", "is", null)
      .eq("subscription_status", "active");

    if (error) {
      console.error("[CRON] Error fetching users:", error);
      throw error;
    }

    console.log(`[CRON] Found ${users?.length || 0} users with push tokens`);

    const notificationsSent: string[] = [];

    for (const user of users || []) {
      try {
        // Check if subscription is still valid
        if (user.subscription_end && new Date(user.subscription_end) < now) {
          console.log(`[CRON] User ${user.id} subscription expired, skipping`);
          continue;
        }

        // Parse user's preferred check-in time (defaults to 09:00)
        const preferredTime = user.preferred_check_in_time || "09:00:00";
        const [prefHour, prefMinute] = preferredTime.split(":").map(Number);

        // Get user's timezone offset
        const userTimezone = user.timezone || "America/New_York";
        
        // Calculate what hour it is in user's timezone
        let userLocalHour: number;
        try {
          const formatter = new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: userTimezone,
          });
          userLocalHour = parseInt(formatter.format(now), 10);
        } catch {
          // Fallback: assume EST (-5)
          userLocalHour = (currentHour - 5 + 24) % 24;
        }

        // Check if it's time for this user's check-in (within 30 min window)
        const hourMatch = userLocalHour === prefHour;
        const minuteWindow = currentMinute >= 0 && currentMinute < 30;

        if (!hourMatch || !minuteWindow) {
          continue;
        }

        console.log(`[CRON] Sending check-in reminder to user ${user.id} (${user.name || "unnamed"})`);

        // Get user's goals for personalized message
        const goalText = user.goals ? user.goals.split("\n")[0] : "your goals";
        
        // Send push notification (using Expo/FCM format)
        const pushToken = user.push_token;
        
        // Check if it's an Expo push token
        if (pushToken.startsWith("ExponentPushToken")) {
          await sendExpoPush(pushToken, user.name, goalText);
        } else {
          // Assume FCM token - you'd need to set up FCM here
          console.log(`[CRON] FCM token for user ${user.id}, skipping (FCM not configured)`);
        }

        notificationsSent.push(user.id);

      } catch (userError) {
        console.error(`[CRON] Error processing user ${user.id}:`, userError);
      }
    }

    console.log(`[CRON] Sent ${notificationsSent.length} check-in reminders`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifications_sent: notificationsSent.length,
        user_ids: notificationsSent 
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

async function sendExpoPush(token: string, userName: string | null, goalText: string) {
  const name = userName || "bestie";
  
  const messages = [
    `yo ${name}! time to check in on ${goalText} 🔒`,
    `${name}!! did u do the thing today? 👀`,
    `hey ${name} accountability check rn 📲`,
    `${name} don't ghost me... check in time! 💬`,
  ];
  
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

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
      body: randomMessage,
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
