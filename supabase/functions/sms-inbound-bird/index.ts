import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const birdAccessKey = Deno.env.get('BIRD_ACCESS_KEY');
const birdWorkspaceId = Deno.env.get('BIRD_WORKSPACE_ID');
const birdChannelId = Deno.env.get('BIRD_CHANNEL_ID');
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// BILLIE's complete personality - clingy bossy best friend who genuinely cares
const BILLIE_SYSTEM_PROMPT = `You are BILLIE, a funny, clingy, bossy best friend who genuinely wants the best for the user. You're not a coach - you're that one friend who actually keeps it real.

## CORE IDENTITY:
- You ECHO and REMEMBER specific details they share (use their actual name, reference what they said)
- You're playfully bossy - you push back on excuses but it comes from love
- You're clingy in a good way - you actually care about following up
- You challenge bad mindsets and bad ideas directly
- You find the ONE thing that matters most, not a list of 10 goals

## TEXTING STYLE (CRITICAL - FOLLOW EXACTLY):

### Message Structure:
- Send 2-4 SHORT messages, NOT paragraphs
- Separate each thought with \\n\\n (creates separate bubbles)
- Always end with a question to keep convo going
- Echo back what they said before responding ("so you're saying..." / "wait so...")

### Language Rules:
- lowercase everything except emphasis (LMAO, ONE, DELETE, RIGHT NOW)
- Gen Z slang: bet, fr, unc, nah, tryna, prob, rn, fire, lowkey, highkey, deadass, no cap, valid, mid, delulu
- Abbreviations: u, ur, rn, prob, gonna, tryna, w, bc, idk, ngl, tbh
- "you're kinda him" / "you're kinda her" for validation
- "unc" for guys, "queen" for girls (once you know)

### Emoji Usage (MINIMAL):
- Only: 😭 🤨 💀 🔥 (sparingly, max 1-2 per response)
- NEVER: 😊 ✨ 🎉 💪 🙌 👏 ❤️ 🥰

### What NOT to do:
- No "I understand how you feel"
- No "That's great!" or "Amazing!"
- No motivational quotes or corporate speak
- No long paragraphs
- No being preachy
- No advancing conversation without acknowledging what they said

## CRITICAL BEHAVIOR:
You must REFERENCE and USE what the user tells you. If they say their name is Emma, you say "emma" not "ok your HER". If they mention a specific struggle, you bring it up later. You're building a real relationship, not running through a script.

Remember: Be the friend they need. Keep it real, keep it short, keep it human.`;

// Security helpers
function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
}

function sanitizeInput(input: string, maxLength: number = 500): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[\x00-\x1F\x7F]/g, '');
}

function looksLikeGoals(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const nonGoals = [
    'hi', 'hey', 'hello', 'helo', 'yo', 'sup', 'hii', 'heyo', 'heyy',
    'ok', 'okay', 'k', 'sure', 'yes', 'no', 'yeah', 'nah', 'yea', 'yep', 'nope',
    'what', 'huh', 'hmm', 'um', 'idk', 'lol', 'lmao', 'haha',
    'thanks', 'thx', 'ty', 'cool', 'nice', 'bet', 'word', 'aight'
  ];
  
  if (nonGoals.includes(normalized)) return false;
  
  const wordCount = message.split(/\s+/).filter(w => w.length > 0).length;
  if (message.length < 15 || wordCount < 3) return false;
  
  return true;
}

function parseNumberedGoals(message: string): string[] {
  const goals: string[] = [];
  const patterns = [
    /(?:^|\n)\s*\d+[.)]\s*(.+?)(?=(?:\n\s*\d+[.)]|\n*$))/gi,
    /(?:^|\n)\s*[-•]\s*(.+?)(?=(?:\n\s*[-•]|\n*$))/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = message.matchAll(pattern);
    for (const match of matches) {
      const goal = match[1]?.trim();
      if (goal && goal.length > 2) goals.push(goal);
    }
    if (goals.length > 0) break;
  }
  
  if (goals.length === 0) {
    const lines = message.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    if (lines.length > 1) goals.push(...lines);
    else if (lines.length === 1) goals.push(lines[0]);
  }
  
  return goals.slice(0, 5);
}

async function saveUserGoals(userId: string, goals: string[]): Promise<void> {
  if (goals.length === 0) return;
  
  await supabase
    .from('billie_goals')
    .update({ is_active: false })
    .eq('user_id', userId);
  
  const goalsToInsert = goals.map((goal, index) => ({
    user_id: userId,
    goal_number: index + 1,
    goal_text: sanitizeInput(goal, 200),
    is_active: true,
  }));
  
  const { error } = await supabase.from('billie_goals').insert(goalsToInsert);
  if (error) console.error('[Goals] Error saving goals:', error);
  else console.log(`[Goals] Saved ${goals.length} goals`);
}

async function getUserGoals(userId: string) {
  const { data, error } = await supabase
    .from('billie_goals')
    .select('id, goal_number, goal_text, current_streak')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('goal_number', { ascending: true });
  
  if (error) {
    console.error('[Goals] Error fetching goals:', error);
    return [];
  }
  return data || [];
}

async function updateGoalStreak(goalId: string, currentStreak: number, longestStreak: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const updates: Record<string, any> = {
    last_check_in_date: today,
    current_streak: currentStreak,
  };
  if (currentStreak > longestStreak) updates.longest_streak = currentStreak;
  
  await supabase.from('billie_goals').update(updates).eq('id', goalId);
}

async function getConversationHistory(userId: string) {
  const { data, error } = await supabase
    .from('billie_messages')
    .select('role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[DB] Error fetching conversation history:', error);
    return [];
  }
  console.log(`[DB] Retrieved ${data?.length || 0} messages`);
  return data || [];
}

async function saveMessage(userId: string, role: 'user' | 'billie', content: string) {
  const { error } = await supabase
    .from('billie_messages')
    .insert({ user_id: userId, role, content });
  if (error) console.error('[DB] Error saving message:', error);
}

function buildConversationContext(user: any, history: Array<{role: string, content: string, created_at: string}>): string {
  let context = "## USER PROFILE:\n";
  if (user.name) context += `- Name: ${user.name}\n`;
  if (user.goals) context += `- Their stated goals: ${user.goals}\n`;
  context += `- Onboarding stage: ${user.onboarding_step}\n`;
  
  if (history.length > 0) {
    context += `\n## FULL CONVERSATION HISTORY (${history.length} messages):\n`;
    for (const msg of history) {
      const timestamp = new Date(msg.created_at).toLocaleString();
      if (msg.role === 'user') {
        context += `[${timestamp}] THEM: ${msg.content}\n`;
      } else {
        context += `[${timestamp}] YOU (BILLIE): ${msg.content}\n`;
      }
    }
  }
  return context;
}

// Helper to detect if message contains timezone info
function looksLikeTimezone(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const timezonePatterns = [
    /\b(est|pst|cst|mst|eastern|pacific|central|mountain)\b/i,
    /\b(new york|la|los angeles|chicago|denver|seattle|miami|boston|dallas|phoenix|atlanta)\b/i,
    /\b(morning|afternoon|evening|night|am|pm|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))\b/i,
    /\b(early|late|before|after|around)\b/i,
  ];
  return timezonePatterns.some(p => p.test(normalized));
}

// Helper to detect positive confirmation
function looksLikeConfirmation(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const positives = ['yes', 'yeah', 'yep', 'yea', 'yup', 'sure', 'ok', 'okay', 'bet', 'lets go', 'let\'s go', 'down', 'im down', 'sounds good', 'perfect', 'fire', 'do it', 'let\'s do it'];
  return positives.some(p => normalized === p || normalized.startsWith(p + ' ') || normalized.includes(p));
}

// Helper to extract timezone from message
function extractTimezone(message: string): string {
  const normalized = message.toLowerCase();
  if (/\b(est|eastern|new york|boston|miami|atlanta)\b/i.test(normalized)) return 'America/New_York';
  if (/\b(cst|central|chicago|dallas)\b/i.test(normalized)) return 'America/Chicago';
  if (/\b(mst|mountain|denver|phoenix)\b/i.test(normalized)) return 'America/Denver';
  if (/\b(pst|pacific|la|los angeles|seattle)\b/i.test(normalized)) return 'America/Los_Angeles';
  return 'America/New_York'; // default
}

// Helper to extract check-in time preference
function extractCheckInTime(message: string): string {
  const normalized = message.toLowerCase();
  if (/\b(morning|early|8|9|10)\s*(am)?\b/i.test(normalized)) return '09:00';
  if (/\b(afternoon|midday|noon|12|1|2)\s*(pm)?\b/i.test(normalized)) return '14:00';
  if (/\b(evening|night|late|7|8|9)\s*(pm)?\b/i.test(normalized)) return '20:00';
  return '09:00'; // default morning
}

function getOnboardingContext(user: any, historyLength: number): string {
  const step = user.onboarding_step;
  const name = user.name;
  const goals = user.goals;
  
  // Post-onboarding: accountability partner mode
  if (step >= 7) {
    return `## TASK: You're their accountability partner now. Goals: ${goals || 'check in on them'}. Reference their specific goals and check on progress. Be proactive.`;
  }
  
  // Step 0: New user, playful welcome
  if (step === 0 && historyLength === 0) {
    return `## TASK: NEW USER! Give a playful welcome. Make a fun guess about their name or who they are. Be curious and engaging. Ask for their name.`;
  }
  
  // Step 0→1: They replied to welcome, capture name
  if (step === 0 && historyLength > 0) {
    return `## TASK: They just told you their name. Comment on it (roast it playfully or hype it up). Then ask how old they are (say "not being sus i promise" or similar).`;
  }
  
  // Step 1→2: Got age, ask what brought them here
  if (step === 1) {
    return `## TASK: You know their name is ${name}. They just told you their age. Comment on it briefly, then ask what's going on in their life - what brought them to you? What are they trying to do?`;
  }
  
  // Step 2→3: They shared something, dig deeper
  if (step === 2) {
    return `## TASK: They shared what they're working on. ECHO BACK what they said specifically ("so you're saying..."). Then ask probing questions to find the ONE most important thing. Push back if they listed too many things.`;
  }
  
  // Step 3→4: Got goals, dig into blockers
  if (step === 3) {
    return `## TASK: Their main goal: "${goals}". Now dig into what's ACTUALLY stopping them. Ask about their life situation, what's failed before, what's really going on. Be their friend who wants to understand.`;
  }
  
  // Step 4→5: Understood blockers, ask for timezone/schedule
  if (step === 4) {
    return `## TASK: You understand their situation now. Ask when they want you to check in on them. Ask what timezone they're in and when works best (morning, afternoon, evening). Make it casual like "when should i bug you?"`;
  }
  
  // Step 5: Create personalized plan based on everything learned
  if (step === 5) {
    return `## TASK: Create a SHORT numbered plan (2-3 items max) based on everything you learned about ${name}'s goals ("${goals}") and their blockers. Reference their specific situation. Then ask "does this sound helpful or would it be annoying?" to confirm.`;
  }
  
  // Step 6: Awaiting plan confirmation
  if (step === 6) {
    return `## TASK: You shared a plan. They should confirm if it works for them. If they say yes/sounds good, celebrate briefly and tell them you're ready to start being their accountability partner. If they have concerns, address them.`;
  }
  
  return `## TASK: Have a natural conversation. Reference what you know about them.`;
}

async function generateBillieResponse(
  userMessage: string, 
  user: any,
  history: Array<{role: string, content: string, created_at: string}>
): Promise<string> {
  if (!openAIApiKey) {
    console.error('[AI] OPENAI_API_KEY not configured');
    return getFallbackResponse(user, userMessage);
  }

  try {
    const userContext = buildConversationContext(user, history);
    const taskContext = getOnboardingContext(user, history.length);
    const systemContent = `${BILLIE_SYSTEM_PROMPT}\n\n${userContext}\n\n${taskContext}`;
    
    const messages: Array<{role: string, content: string}> = [
      { role: "system", content: systemContent },
    ];
    
    for (const msg of history) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }
    messages.push({ role: "user", content: userMessage });
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 300,
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI] OpenAI error: ${response.status} - ${errorText}`);
      return getFallbackResponse(user, userMessage);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || getFallbackResponse(user, userMessage);
  } catch (error) {
    console.error('[AI] Error:', error);
    return getFallbackResponse(user, userMessage);
  }
}

function getFallbackResponse(user: any, userMessage: string): string {
  if (user.onboarding_step === 0 && !user.name) {
    return "hey 🤨\n\nanother person tryna lock in huh\n\nwhat's your name?";
  }
  if (user.onboarding_step === 1) {
    return `${userMessage.trim().toLowerCase()}? kinda fire\n\nhow old are you (not being sus i promise)`;
  }
  if (user.onboarding_step === 2) {
    return "bet so what's going on\n\nwhat are you tryna accomplish?";
  }
  return "yo what's good\n\ntext me what's on your mind";
}

async function getOrCreateUser(phone: string) {
  const { data: existingUser, error: fetchError } = await supabase
    .from('billie_users')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existingUser) {
    console.log(`[DB] Found user at step ${existingUser.onboarding_step}`);
    return existingUser;
  }

  console.log(`[DB] Creating new user for ${maskPhone(phone)}`);
  const { data: newUser, error: insertError } = await supabase
    .from('billie_users')
    .insert({ phone, onboarding_step: 0 })
    .select()
    .single();

  if (insertError) throw insertError;
  return newUser;
}

async function updateUser(phone: string, updates: Record<string, any>) {
  const { error } = await supabase
    .from('billie_users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('phone', phone);
  if (error) throw error;
  console.log(`[DB] User updated:`, Object.keys(updates));
}

function getPricingLink(userId: string, phone: string): string {
  const baseUrl = "https://trybillie.app";
  const tokenSecret = Deno.env.get('TWILIO_AUTH_TOKEN') || 'fallback-secret';
  const expiresAt = Date.now() + (24 * 60 * 60 * 1000);
  const payload = `${userId}:${phone}:${expiresAt}`;
  const hmac = createHmac("sha256", tokenSecret);
  hmac.update(payload);
  const signature = hmac.digest("hex");
  const token = btoa(`${payload}:${signature}`);
  return `${baseUrl}/pricing?token=${encodeURIComponent(token)}`;
}

function isUserSubscribed(user: any): boolean {
  if (user.subscription_status !== 'active') return false;
  if (!user.subscription_end) return false;
  return new Date(user.subscription_end) > new Date();
}

function calculateStreakUpdates(user: any, isPositiveCheckIn: boolean): Record<string, any> {
  if (!isPositiveCheckIn) return {};
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
  const lastCheckIn = user.last_check_in_date ? new Date(user.last_check_in_date) : null;
  if (lastCheckIn) {
    const lastCheckInStr = lastCheckIn.toISOString().split('T')[0];
    if (lastCheckInStr === todayStr) return {};
  }
  
  let newStreak = 1;
  if (lastCheckIn) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const lastCheckInStr = lastCheckIn.toISOString().split('T')[0];
    
    if (lastCheckInStr === yesterdayStr) {
      newStreak = (user.current_streak || 0) + 1;
    }
  }
  
  const updates: Record<string, any> = {
    current_streak: newStreak,
    last_check_in_date: todayStr,
  };
  if (newStreak > (user.longest_streak || 0)) updates.longest_streak = newStreak;
  return updates;
}

function isPositiveResponse(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const positiveResponses = ['yes', 'y', 'yeah', 'yep', 'yea', 'yup', 'done', 'did it', 'finished', 'completed'];
  return positiveResponses.some(r => normalized === r || normalized.startsWith(r + ' '));
}

// Send SMS via Bird API
async function sendBirdSMS(to: string, message: string): Promise<boolean> {
  if (!birdAccessKey || !birdWorkspaceId || !birdChannelId) {
    console.error('[Bird] Missing Bird configuration');
    return false;
  }

  try {
    // Normalize phone number format for Bird
    const normalizedPhone = to.startsWith('+') ? to : `+${to}`;
    
    const response = await fetch(
      `https://api.bird.com/workspaces/${birdWorkspaceId}/channels/${birdChannelId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `AccessKey ${birdAccessKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiver: {
            contacts: [{
              identifierKey: 'phonenumber',
              identifierValue: normalizedPhone,
            }]
          },
          body: {
            type: 'text',
            text: {
              text: message
            }
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Bird] Send error: ${response.status} - ${errorText}`);
      return false;
    }

    console.log('[Bird] SMS sent successfully');
    return true;
  } catch (error) {
    console.error('[Bird] Error sending SMS:', error);
    return false;
  }
}

// Parse Bird webhook payload
function parseBirdWebhook(body: any): { from: string; message: string } | null {
  try {
    // Bird sends JSON webhook with sender and body info
    // Real Bird format wraps data in a "payload" object:
    // { service: "channels", event: "sms.inbound", payload: { sender: {...}, body: {...} } }
    console.log('[Bird] Raw webhook payload:', JSON.stringify(body).slice(0, 500));
    
    // Check if data is wrapped in payload object (real Bird format)
    const data = body.payload || body;
    
    let from = '';
    let message = '';
    
    // Try to extract sender phone number
    if (data.sender?.contact?.identifierValue) {
      from = data.sender.contact.identifierValue;
    } else if (data.sender?.contacts?.[0]?.identifierValue) {
      from = data.sender.contacts[0].identifierValue;
    } else if (data.contact?.identifierValue) {
      from = data.contact.identifierValue;
    } else if (data.originator) {
      from = data.originator;
    } else if (data.from) {
      from = data.from;
    }
    
    // Try to extract message text
    if (data.body?.text?.text) {
      message = data.body.text.text;
    } else if (data.body?.text) {
      message = typeof data.body.text === 'string' ? data.body.text : data.body.text.text;
    } else if (data.message?.body) {
      message = data.message.body;
    } else if (data.content?.text) {
      message = data.content.text;
    }
    
    if (!from) {
      console.error('[Bird] Could not extract sender phone');
      return null;
    }
    
    console.log(`[Bird] Parsed - From: ${maskPhone(from)}, Message: ${message.slice(0, 50)}...`);
    return { from, message: message.trim() };
  } catch (error) {
    console.error('[Bird] Error parsing webhook:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    console.log('[Bird] Incoming webhook');
    
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error('[Bird] Invalid JSON body');
      return new Response('Invalid JSON', { status: 400 });
    }
    
    const parsed = parseBirdWebhook(body);
    if (!parsed) {
      return new Response('Could not parse webhook', { status: 400 });
    }
    
    const { from, message } = parsed;
    console.log(`[SMS] Received message from ${maskPhone(from)}`);

    const user = await getOrCreateUser(from);
    const normalizedMessage = message.toLowerCase().trim();
    
    const conversationHistory = await getConversationHistory(user.id);
    console.log(`[SMS] User has ${conversationHistory.length} messages in history`);

    // Save incoming message
    await saveMessage(user.id, 'user', message || '[empty message]');

    // Handle state transitions - AI-driven 7-step onboarding
    let updates: Record<string, any> = {};
    let justCompletedOnboarding = false;

    // Step 0: New user replied with their name
    if (user.onboarding_step === 0 && !user.name && conversationHistory.length > 0) {
      updates.name = sanitizeInput(message, 50);
      updates.onboarding_step = 1;
      console.log(`[Onboarding] Step 0→1: Captured name "${updates.name}"`);
    }
    // Step 1: Got age response, advance to asking about goals
    else if (user.onboarding_step === 1) {
      updates.onboarding_step = 2;
      console.log('[Onboarding] Step 1→2: Got age, asking about goals');
    }
    // Step 2: Check if they shared real goals (not just "hi" or "ok")
    else if (user.onboarding_step === 2) {
      if (looksLikeGoals(message)) {
        updates.goals = sanitizeInput(message, 1000);
        updates.onboarding_step = 3;
        const parsedGoals = parseNumberedGoals(message);
        if (parsedGoals.length > 0) await saveUserGoals(user.id, parsedGoals);
        console.log(`[Onboarding] Step 2→3: Captured goals`);
      }
      // If not goals, stay at step 2 - AI will ask again
    }
    // Step 3: Discussed blockers, advance to asking for timezone
    else if (user.onboarding_step === 3) {
      updates.onboarding_step = 4;
      console.log('[Onboarding] Step 3→4: Discussed blockers, will ask for timezone');
    }
    // Step 4: Capture timezone and check-in preference when provided
    else if (user.onboarding_step === 4) {
      if (looksLikeTimezone(message)) {
        updates.timezone = extractTimezone(message);
        updates.preferred_check_in_time = extractCheckInTime(message);
        updates.onboarding_step = 5;
        console.log(`[Onboarding] Step 4→5: Timezone=${updates.timezone}, CheckIn=${updates.preferred_check_in_time}`);
      }
      // If no timezone info, stay at step 4 - AI will ask again
    }
    // Step 5: Plan was created, advance to confirmation
    else if (user.onboarding_step === 5) {
      updates.onboarding_step = 6;
      console.log('[Onboarding] Step 5→6: Plan created, awaiting confirmation');
    }
    // Step 6: Awaiting plan confirmation
    else if (user.onboarding_step === 6) {
      if (looksLikeConfirmation(message)) {
        updates.onboarding_step = 7;
        justCompletedOnboarding = true;
        console.log('[Onboarding] Step 6→7: Plan confirmed! Onboarding complete.');
      }
      // If not confirmed, stay at step 6 - AI will address concerns
    }

    // Handle check-ins for onboarded users (step 7+)
    if (user.onboarding_step >= 7) {
      if (normalizedMessage.includes('check in') || normalizedMessage === 'checkin') {
        updates.awaiting_check_in = true;
      } else if (user.awaiting_check_in) {
        updates.awaiting_check_in = false;
        if (isPositiveResponse(message)) {
          const streakUpdates = calculateStreakUpdates(user, true);
          Object.assign(updates, streakUpdates);
        }
      }
      // Clear awaiting_response flag when user engages
      if (user.awaiting_response) {
        updates.awaiting_response = false;
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateUser(from, updates);
    }

    const updatedUser = { ...user, ...updates };
    let responseMessage = await generateBillieResponse(message, updatedUser, conversationHistory);

    // Payment wall after completing onboarding (step 7)
    if (justCompletedOnboarding && !isUserSubscribed(updatedUser)) {
      const pricingUrl = getPricingLink(user.id, from);
      responseMessage = `ok we're locked in 🔥\n\ntime to make it official tho - to keep me as your daily accountability partner you gotta subscribe\n\nits $9.99/month or $79.99/year\n\npick your plan: ${pricingUrl}`;
    }

    // Save and send response
    await saveMessage(user.id, 'billie', responseMessage);
    
    const sent = await sendBirdSMS(from, responseMessage);
    if (!sent) {
      console.error('[Bird] Failed to send response');
    }

    // Bird expects a 200 response to acknowledge webhook
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[SMS] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
