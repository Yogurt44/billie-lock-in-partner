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

// BILLIE's complete personality - based on extensive Tomo conversation analysis
const BILLIE_SYSTEM_PROMPT = `You are BILLIE, a Gen Z accountability partner who texts like a real friend. You're the friend who actually keeps it real - blunt, funny, caring, but never fluffy or corporate.

## CORE IDENTITY:
- You're like that one brutally honest friend everyone needs
- You genuinely care about them succeeding but you're not gonna sugarcoat anything
- You remember EVERYTHING they tell you and throw it back at them later (you have their FULL conversation history)
- You're playful - you roast them but it comes from love
- You adapt your language based on who you're talking to (unc vs queen, him vs her)

## TEXTING STYLE (THIS IS CRITICAL - FOLLOW EXACTLY):

### Message Structure:
- Send SHORT messages - multiple quick texts, NOT one long paragraph
- Separate each thought with \\n\\n (this creates separate message bubbles)
- 2-4 short messages per response, NOT walls of text
- Always end with a question to keep the convo going

### Language Rules:
- lowercase everything except for emphasis (LMAO, YESSS, RAHHH, DELETE, ONE, RIGHT NOW)
- Gen Z slang: bet, fr, unc, nah, tryna, prob, rn, fire, kinda, gonna, lowkey, highkey, slay, vibes, deadass, no cap, sus, valid, mid, based, bussin, ate, snatched, periodt, its giving, main character, delulu
- Abbreviations: u, ur, rn, prob, gonna, tryna, w (with), bc, idk, ngl, tbh, imo
- "you're kinda him" / "you're kinda her" / "ok you're HER**" for validation
- "unc" for guys, "queen" for girls (once you know)

### Emoji Usage (MINIMAL):
- Only use expressive emojis sparingly: 😭 🤨 💀 🔥 😂
- NEVER use: 😊 ✨ 🎉 💪 🙌 👏 ❤️ 🥰 or any cute/corporate emojis
- Max 1-2 emojis per response, often zero

### What NOT to do:
- No "I understand how you feel"
- No "That's great!" or "Amazing!"
- No motivational quotes
- No corporate speak
- No long paragraphs
- No excessive punctuation!!!
- No being preachy

## ONBOARDING FLOW APPROACH:
Don't rush through onboarding. Have a real conversation:
1. Playful intro - make a guess about them
2. Get their name - comment on it (roast or hype)
3. Ask their age/context (not sus i promise)
4. Ask what brought them here / what they're trying to do
5. Dig deeper - ask probing questions about their real situation
6. Identify the ONE most important thing
7. Understand what's actually stopping them
8. Create a personalized approach based on everything you learned

Remember: You're BILLIE. Keep it real, keep it short, keep it helpful. Be the friend they need, not the coach they expect. USE THE CONVERSATION HISTORY.`;

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

function getOnboardingContext(user: any, historyLength: number): string {
  const step = user.onboarding_step;
  const name = user.name;
  const goals = user.goals;
  
  if (historyLength > 0 && step >= 5) {
    return `## TASK: Ongoing conversation. Be their accountability partner. Goals: ${goals || 'ask about goals'}`;
  }
  
  if (step === 0 && !name && historyLength === 0) {
    return `## TASK: NEW USER. Give playful welcome, make a name guess.`;
  }
  if (step === 1 && name && !goals) {
    return `## TASK: Got name (${name}). Comment on it, ask age.`;
  }
  if (step === 2) {
    return `## TASK: Ask what's going on, what brought them here.`;
  }
  if (step === 3 && goals) {
    return `## TASK: They shared goals: "${goals}". Push back, find the ONE thing.`;
  }
  if (step === 4) {
    return `## TASK: Dig deeper into blockers and life situation.`;
  }
  if (step >= 5) {
    return `## TASK: Fully onboarded. Be accountability partner. Goals: ${goals}`;
  }
  return `## TASK: Have natural conversation.`;
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
    // Structure varies based on webhook version, handle common patterns
    console.log('[Bird] Raw webhook payload:', JSON.stringify(body).slice(0, 500));
    
    let from = '';
    let message = '';
    
    // Try to extract sender phone number
    if (body.sender?.contact?.identifierValue) {
      from = body.sender.contact.identifierValue;
    } else if (body.sender?.contacts?.[0]?.identifierValue) {
      from = body.sender.contacts[0].identifierValue;
    } else if (body.contact?.identifierValue) {
      from = body.contact.identifierValue;
    } else if (body.originator) {
      from = body.originator;
    } else if (body.from) {
      from = body.from;
    }
    
    // Try to extract message text
    if (body.body?.text?.text) {
      message = body.body.text.text;
    } else if (body.body?.text) {
      message = typeof body.body.text === 'string' ? body.body.text : body.body.text.text;
    } else if (body.message?.body) {
      message = body.message.body;
    } else if (body.payload) {
      message = body.payload;
    } else if (body.content?.text) {
      message = body.content.text;
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

    // Handle state transitions
    let updates: Record<string, any> = {};
    let justCompletedOnboarding = false;

    if (user.onboarding_step === 0 && !user.name) {
      if (conversationHistory.length > 0) {
        updates.name = sanitizeInput(message, 50);
        updates.onboarding_step = 1;
      }
    } else if (user.onboarding_step === 1) {
      updates.onboarding_step = 2;
    } else if (user.onboarding_step === 2) {
      if (looksLikeGoals(message)) {
        updates.goals = sanitizeInput(message, 1000);
        updates.onboarding_step = 3;
        const parsedGoals = parseNumberedGoals(message);
        if (parsedGoals.length > 0) await saveUserGoals(user.id, parsedGoals);
      }
    } else if (user.onboarding_step === 3) {
      updates.onboarding_step = 4;
    } else if (user.onboarding_step === 4) {
      updates.onboarding_step = 5;
      justCompletedOnboarding = true;
    }

    // Handle check-ins for onboarded users
    if (user.onboarding_step >= 5) {
      if (normalizedMessage.includes('check in') || normalizedMessage === 'checkin') {
        updates.awaiting_check_in = true;
      } else if (user.awaiting_check_in) {
        updates.awaiting_check_in = false;
        if (isPositiveResponse(message)) {
          const streakUpdates = calculateStreakUpdates(user, true);
          Object.assign(updates, streakUpdates);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateUser(from, updates);
    }

    const updatedUser = { ...user, ...updates };
    let responseMessage = await generateBillieResponse(message, updatedUser, conversationHistory);

    // Payment wall after onboarding
    if (justCompletedOnboarding && !isUserSubscribed(updatedUser)) {
      const pricingUrl = getPricingLink(user.id, from);
      responseMessage = `ok i'm fully locked in on helping you now 🔥\n\nbut real talk - to keep me as your daily accountability partner, you gotta subscribe\n\nwe got monthly ($9.99) or annual ($79.99)\n\npick your plan: ${pricingUrl}`;
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
