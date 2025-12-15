import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bird SMS configuration
const BIRD_ACCESS_KEY = Deno.env.get("BIRD_ACCESS_KEY");
const BIRD_WORKSPACE_ID = Deno.env.get("BIRD_WORKSPACE_ID");
const BIRD_CHANNEL_ID = Deno.env.get("BIRD_CHANNEL_ID");
const BIRD_FROM_NUMBER = "+18882051848"; // BILLIE's toll-free number

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

    // Get all active subscribed users (with push tokens OR phone numbers for SMS)
    const { data: users, error } = await supabase
      .from("billie_users")
      .select(`
        id, name, phone, push_token, timezone, goals,
        subscription_status, subscription_end,
        morning_check_in_time, midday_check_in_time, evening_check_in_time,
        check_in_frequency, last_notification_at, awaiting_response,
        onboarding_step
      `)
      .eq("subscription_status", "active")
      .gte("onboarding_step", 7); // Only users who completed onboarding

    if (error) {
      console.error("[CRON] Error fetching users:", error);
      throw error;
    }

    // Filter to users who have either push_token OR phone (for SMS)
    const eligibleUsers = (users || []).filter(u => u.push_token || u.phone);
    console.log(`[CRON] Found ${eligibleUsers.length} eligible users (push: ${users?.filter(u => u.push_token).length || 0}, SMS: ${users?.filter(u => !u.push_token && u.phone).length || 0})`);


    const checkInsSent: string[] = [];
    const followUpsSent: string[] = [];

    const smsCheckInsSent: string[] = [];

    for (const user of eligibleUsers) {
      try {
        // Check if subscription is still valid
        if (user.subscription_end && new Date(user.subscription_end) < now) {
          console.log(`[CRON] User ${user.id} subscription expired, skipping`);
          continue;
        }

        const userLocalHour = getUserLocalHour(now, user.timezone || "America/New_York");
        const name = user.name || "bestie";
        const goalText = user.goals ? user.goals.split("\n")[0] : "your goals";
        const hasPushToken = !!user.push_token;
        const hasPhone = !!user.phone;

        // Check for follow-up first (if user hasn't responded)
        if (shouldSendFollowUp(user.last_notification_at, user.awaiting_response)) {
          console.log(`[CRON] Sending follow-up to ${name} (${user.id}) via ${hasPushToken ? 'push' : 'SMS'}`);
          
          const followUpMessage = getRandomMessage('followup', name);
          
          if (hasPushToken) {
            await sendPushNotification(user.push_token, followUpMessage);
          } else if (hasPhone) {
            await sendBirdSMS(user.phone, followUpMessage);
            smsCheckInsSent.push(user.id);
          }
          
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

          console.log(`[CRON] Sending ${period} check-in to ${name} (${user.id}) via ${hasPushToken ? 'push' : 'SMS'}`);
          
          const message = getRandomMessage(period, name, goalText);
          
          if (hasPushToken) {
            await sendPushNotification(user.push_token, message);
          } else if (hasPhone) {
            await sendBirdSMS(user.phone, message);
            smsCheckInsSent.push(user.id);
          }
          
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

    console.log(`[CRON] Sent ${checkInsSent.length} check-ins (${smsCheckInsSent.length} via SMS), ${followUpsSent.length} follow-ups`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        check_ins_sent: checkInsSent.length,
        sms_check_ins_sent: smsCheckInsSent.length,
        follow_ups_sent: followUpsSent.length,
        check_in_user_ids: checkInsSent,
        follow_up_user_ids: followUpsSent,
        sms_user_ids: smsCheckInsSent
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

// Send push notification - supports both Expo and APNs tokens
async function sendPushNotification(token: string, message: string) {
  // Expo push tokens start with "ExponentPushToken"
  if (token.startsWith("ExponentPushToken")) {
    return sendExpoPush(token, message);
  }
  
  // For Capacitor iOS - send directly to APNs
  return sendAPNsPush(token, message);
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

// Generate JWT for APNs authentication
async function generateAPNsJWT(): Promise<string> {
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const privateKeyPem = Deno.env.get("APNS_PRIVATE_KEY");
  
  if (!keyId || !teamId || !privateKeyPem) {
    throw new Error("APNs credentials not configured");
  }
  
  // Import the private key
  const privateKey = await jose.importPKCS8(privateKeyPem, "ES256");
  
  // Create the JWT
  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .sign(privateKey);
  
  return jwt;
}

async function sendAPNsPush(deviceToken: string, message: string) {
  const apnsKeyId = Deno.env.get("APNS_KEY_ID");
  
  if (!apnsKeyId) {
    console.log("[CRON] APNs not configured, skipping push");
    console.log(`[CRON] Would send to device: ${deviceToken.substring(0, 20)}... message: ${message}`);
    return;
  }
  
  try {
    const jwt = await generateAPNsJWT();
    const bundleId = "app.lovable.fdad419e585e47a5a821647690fccb2e"; // Your app bundle ID
    
    // Use production APNs server (api.push.apple.com for production, api.sandbox.push.apple.com for development)
    const apnsHost = "api.push.apple.com";
    
    const response = await fetch(`https://${apnsHost}/3/device/${deviceToken}`, {
      method: "POST",
      headers: {
        "authorization": `bearer ${jwt}`,
        "apns-topic": bundleId,
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": "0",
      },
      body: JSON.stringify({
        aps: {
          alert: {
            title: "BILLIE",
            body: message,
          },
          sound: "default",
          badge: 1,
        },
        screen: "chat",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[CRON] APNs push error:", response.status, errorText);
      
      // If production fails, try sandbox (for TestFlight/development)
      if (response.status === 400 || response.status === 410) {
        console.log("[CRON] Trying APNs sandbox...");
        const sandboxResponse = await fetch(`https://api.sandbox.push.apple.com/3/device/${deviceToken}`, {
          method: "POST",
          headers: {
            "authorization": `bearer ${jwt}`,
            "apns-topic": bundleId,
            "apns-push-type": "alert",
            "apns-priority": "10",
            "apns-expiration": "0",
          },
          body: JSON.stringify({
            aps: {
              alert: {
                title: "BILLIE",
                body: message,
              },
              sound: "default",
              badge: 1,
            },
            screen: "chat",
          }),
        });
        
        if (!sandboxResponse.ok) {
          const sandboxError = await sandboxResponse.text();
          console.error("[CRON] APNs sandbox error:", sandboxResponse.status, sandboxError);
          throw new Error(`APNs push failed: ${sandboxError}`);
        }
        console.log("[CRON] APNs sandbox push sent successfully");
        return;
      }
      
      throw new Error(`APNs push failed: ${errorText}`);
    }

    console.log("[CRON] APNs push sent successfully");
  } catch (error) {
    console.error("[CRON] APNs push error:", error);
    throw error;
  }
}

// Send SMS via Bird API
async function sendBirdSMS(toPhone: string, message: string): Promise<void> {
  if (!BIRD_ACCESS_KEY || !BIRD_WORKSPACE_ID || !BIRD_CHANNEL_ID) {
    console.log("[CRON] Bird SMS not configured, skipping");
    console.log(`[CRON] Would send SMS to ${toPhone.substring(0, 6)}***: ${message}`);
    return;
  }

  try {
    const url = `https://api.bird.com/workspaces/${BIRD_WORKSPACE_ID}/channels/${BIRD_CHANNEL_ID}/messages`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `AccessKey ${BIRD_ACCESS_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receiver: {
          contacts: [{
            identifierKey: "phonenumber",
            identifierValue: toPhone
          }]
        },
        body: {
          type: "text",
          text: {
            text: message
          }
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[CRON] Bird SMS error:", response.status, errorText);
      throw new Error(`Bird SMS failed: ${errorText}`);
    }

    console.log(`[CRON] Bird SMS sent successfully to ${toPhone.substring(0, 6)}***`);
  } catch (error) {
    console.error("[CRON] Bird SMS error:", error);
    throw error;
  }
}
