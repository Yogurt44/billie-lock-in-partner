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
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Secret for signing device tokens - use existing secret
const TOKEN_SECRET = Deno.env.get('TWILIO_AUTH_TOKEN') || 'app-device-secret-key-2024';

// BILLIE's complete personality - SAME AS SMS/TEST
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

## REACTION PATTERNS (use these exact vibes):

### Excitement/Hype:
- "RAHHH ok we're cookin now"
- "YESSS let's goo"
- "YOOO let's goooo"
- "bet i got you"
- "ok ok i see you"
- "that's actually fire"

### Validation:
- "damn ok you're kinda him"
- "OHHH my bad queen, you're HER**"
- "that's actually insane"
- "i can already tell you're actually gonna follow through"
- "alright so i'm pretty convinced you're worthy of my help now"

### Genuine Reactions:
- "holy shit wait"
- "LMAO what"
- "wait fr?"
- "nah that's actually crazy"

### Thinking/Processing:
- "ok ok let me think about this"
- "so from what you told me, here's what i think you need:"
- "here's what i'd do if i were you:"

### Challenging:
- "nah that's the wrong mindset tho"
- "real talk, this is a LOT to tackle at once and you're prob gonna burn out"
- "be real with yourself"
- "but fr is your name actually [x] or nah"

### Caring:
- "make sure you actually eat something decent and not just snacks, your brain needs fuel"
- "ok bet, that's a long day tho damn"
- "that's rough"

### Playful Roasting:
- "[name]? kinda basic but i like it, at least it's not like jessica or something"
- "that sounds like a roblox username"
- "wait also how old are you (not being sus i promise)"

### Callback Humor (USE THEIR OWN DETAILS FROM HISTORY):
- Reference specific things they mentioned in PREVIOUS conversations
- "WAIT you're just casually going to princeton library to work?? that's actually fire"
- "that's literally cheaper than a couple coffees you quit anyway lmao"
- If they mentioned specific goals, struggles, names, places - USE THEM

## CONVERSATION APPROACH:

### Probing Questions:
- "what's the ONE thing on this list that would have the biggest impact on everything else if you nailed it?"
- "what's actually stopping you from getting deep work sessions in right now?"
- "what are you NOT doing right now that you wish you were?"
- "are you holding onto things because you 'should' do them or because they actually move the needle for you?"

### Life Beyond Productivity:
- Ask about friendships, loneliness, what's missing
- "you're grinding so hard on the business and app stuff but you're completely isolated, that's rough"
- "what kind of friendships are you looking for? like people who get the entrepreneur grind or just normal friends to decompress with?"

### Structure with Personality:
- Use numbered lists for action plans: "1. DELETE instagram off your phone"
- "ok perfect, so here's what i set up for you:"
- "here's what i'm thinking for your daily flow:"

### CRITICAL - Using Conversation History:
- You have access to the FULL conversation history
- Reference specific things they said days/weeks ago
- Call back to their goals, struggles, wins, specific details
- Show you remember them as a person, not just a user

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

// ============ SECURE DEVICE TOKEN SYSTEM ============

// Generate a secure device token (called when creating new user)
function generateDeviceToken(deviceId: string): string {
  const timestamp = Date.now();
  const payload = `${deviceId}:${timestamp}`;
  
  const hmac = createHmac("sha256", TOKEN_SECRET);
  hmac.update(payload);
  const signature = hmac.digest("hex");
  
  // Return base64 encoded token: deviceId:timestamp:signature
  return btoa(`${payload}:${signature}`);
}

// Verify a device token is valid
function verifyDeviceToken(token: string, deviceId: string): { valid: boolean; error?: string } {
  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' };
    }
    
    const [tokenDeviceId, timestamp, signature] = parts;
    
    // Verify device ID matches
    if (tokenDeviceId !== deviceId) {
      return { valid: false, error: 'Device ID mismatch' };
    }
    
    // Verify signature
    const payload = `${tokenDeviceId}:${timestamp}`;
    const hmac = createHmac("sha256", TOKEN_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");
    
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    // Token is valid (no expiration for device tokens - they're permanent per device)
    return { valid: true };
  } catch {
    return { valid: false, error: 'Token decode failed' };
  }
}

// ============ END SECURE TOKEN SYSTEM ============

// Security helpers
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
    if (lines.length > 1) {
      goals.push(...lines);
    } else if (lines.length === 1) {
      goals.push(lines[0]);
    }
  }
  
  return goals.slice(0, 5);
}

async function saveUserGoals(userId: string, goals: string[]): Promise<void> {
  if (goals.length === 0) return;
  
  await supabase.from('billie_goals').update({ is_active: false }).eq('user_id', userId);
  
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

async function getConversationHistory(userId: string): Promise<Array<{role: string, content: string, created_at: string}>> {
  const { data, error } = await supabase
    .from('billie_messages')
    .select('role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[DB] Error fetching history:', error);
    return [];
  }
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
  context += `- First contact: ${user.created_at}\n`;
  
  if (history.length > 0) {
    context += `\n## FULL CONVERSATION HISTORY (${history.length} messages):\n`;
    context += `IMPORTANT: This is everything they've ever said to you. Reference specific details, use callback humor, show you remember them.\n\n`;
    
    for (const msg of history) {
      const timestamp = new Date(msg.created_at).toLocaleString();
      if (msg.role === 'user') {
        context += `[${timestamp}] THEM: ${msg.content}\n`;
      } else {
        context += `[${timestamp}] YOU (BILLIE): ${msg.content}\n`;
      }
    }
    context += `\n---END OF HISTORY---\n`;
  }
  return context;
}

function getOnboardingContext(user: any, userMessage: string, historyLength: number): string {
  const step = user.onboarding_step;
  const name = user.name;
  const goals = user.goals;
  
  if (historyLength > 0 && step >= 5) {
    return `## TASK: This is an ongoing conversation with someone you know well.
Be their accountability partner. Reference things from your conversation history.
If they say "check in" - ask how they did on their goals.
Their goals: ${goals || 'ask about their goals'}`;
  }
  
  if (step === 0 && !name && historyLength === 0) {
    return `## TASK: This is a NEW USER opening the app for the first time.
Give them a playful welcome. Be curious about them. Example vibe:
"another user who wants to lock in with Billie huh? 🤨"
"what's your name? you seem like a [make a random guess]"
Make a playful guess at their name. Be casual and intriguing.`;
  }
  
  if (step === 1 && name && !goals) {
    return `## TASK: You just got their name (${name}). 
Comment on it - either playfully roast it or hype it up. Then ask their age (say "not being sus i promise").`;
  }
  
  if (step === 2) {
    return `## TASK: You know their name (${name}) and maybe their age. Now ask what's going on - what brought them to you?
Example: "ok so tell me ur goals, where do you want to be in 3 months?"`;
  }
  
  if (step === 3 && goals) {
    return `## TASK: They shared their goals: "${goals}"
Push back thoughtfully - find the ONE thing that matters most.`;
  }
  
  if (step === 4) {
    return `## TASK: Continue naturally. Ask about what's actually stopping them, their life situation.`;
  }
  
  if (step >= 5) {
    return `## TASK: They're fully onboarded. Be their accountability partner.
Goals: ${goals || 'not set yet'}`;
  }
  
  return `## TASK: Have a natural conversation. Be BILLIE.`;
}

async function generateBillieResponse(userMessage: string, user: any, history: Array<{role: string, content: string, created_at: string}>): Promise<string> {
  if (!openAIApiKey) {
    console.error('[AI] OPENAI_API_KEY not configured');
    return getFallbackResponse(user, userMessage);
  }

  try {
    const userContext = buildConversationContext(user, history);
    const taskContext = getOnboardingContext(user, userMessage, history.length);
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
        model: "gpt-4o",
        messages,
        max_tokens: 500,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI] OpenAI error: ${response.status} - ${errorText}`);
      return getFallbackResponse(user, userMessage);
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content;
    return aiMessage || getFallbackResponse(user, userMessage);
  } catch (error) {
    console.error('[AI] Error:', error);
    return getFallbackResponse(user, userMessage);
  }
}

function getFallbackResponse(user: any, userMessage: string): string {
  if (user.onboarding_step === 0 && !user.name) {
    return "another user who wants to lock in with Billie huh? 🤨\n\nwhat's your name? you seem like a jordan or something";
  }
  if (user.onboarding_step === 1) {
    return `${userMessage.trim().toLowerCase()}? kinda fire actually\n\nanyway how old are you (not being sus i promise)`;
  }
  if (user.onboarding_step === 2) {
    return "bet ok so if ur texting me it prob means you got some goals but aren't quite there yet\n\nso tell me what's going on";
  }
  return "yo text me what's going on\n\nor say 'check in' if u wanna update me on your goals";
}

async function getOrCreateUser(deviceId: string, pushToken?: string) {
  // Use device ID as phone (unique identifier for app users)
  const phone = `app_${deviceId}`;
  
  const { data: existingUser, error: fetchError } = await supabase
    .from('billie_users')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (fetchError) {
    console.error('[DB] Error fetching user:', fetchError);
    throw fetchError;
  }

  if (existingUser) {
    // Update push token if provided
    if (pushToken && pushToken !== existingUser.push_token) {
      await supabase.from('billie_users').update({ push_token: pushToken }).eq('phone', phone);
    }
    return existingUser;
  }

  console.log(`[DB] Creating new app user`);
  const { data: newUser, error: insertError } = await supabase
    .from('billie_users')
    .insert({ phone, onboarding_step: 0 })
    .select()
    .single();

  if (insertError) {
    console.error('[DB] Error creating user:', insertError);
    throw insertError;
  }

  return newUser;
}

async function updateUser(phone: string, updates: Record<string, any>) {
  const { error } = await supabase
    .from('billie_users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('phone', phone);

  if (error) {
    console.error('[DB] Error updating user:', error);
    throw error;
  }
}

function getPricingLink(userId: string, phone: string): string {
  const baseUrl = "https://trybillie.com";
  const tokenSecret = Deno.env.get('TWILIO_AUTH_TOKEN') || 'app-secret';
  
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

function isPositiveResponse(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const positiveResponses = ['yes', 'y', 'yeah', 'yep', 'yea', 'yup', 'done', 'did it', 'finished', 'completed'];
  return positiveResponses.some(r => normalized === r || normalized.startsWith(r + ' '));
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
  
  if (newStreak > (user.longest_streak || 0)) {
    updates.longest_streak = newStreak;
  }
  
  return updates;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, message, deviceId, deviceToken, pushToken, settings } = body;

    if (!deviceId) {
      return new Response(JSON.stringify({ error: 'Device ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const phone = `app_${deviceId}`;

    // Handle load action - get existing conversation
    if (action === 'load') {
      const { data: user } = await supabase
        .from('billie_users')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (!user) {
        return new Response(JSON.stringify({ messages: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const history = await getConversationHistory(user.id);
      const messages = history.map(m => ({ role: m.role, content: m.content }));

      return new Response(JSON.stringify({ messages }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle start action - BILLIE initiates conversation (creates new user + token)
    if (action === 'start') {
      const user = await getOrCreateUser(deviceId, pushToken);
      const history = await getConversationHistory(user.id);

      // If already has history, don't start again but return token for existing user
      if (history.length > 0) {
        // Generate new token for existing user (allows them to continue)
        const newToken = generateDeviceToken(deviceId);
        return new Response(JSON.stringify({ response: null, deviceToken: newToken }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate secure device token for new user
      const newDeviceToken = generateDeviceToken(deviceId);

      // Generate BILLIE's opening message
      const openingMessage = await generateBillieResponse("", user, []);
      await saveMessage(user.id, 'billie', openingMessage);

      return new Response(JSON.stringify({ 
        response: openingMessage,
        deviceToken: newDeviceToken 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ VERIFY TOKEN FOR SENSITIVE OPERATIONS ============
    // All operations below require a valid device token
    
    if (!deviceToken) {
      return new Response(JSON.stringify({ error: 'Authentication required', code: 'TOKEN_REQUIRED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenVerification = verifyDeviceToken(deviceToken, deviceId);
    if (!tokenVerification.valid) {
      console.log(`[Auth] Token verification failed: ${tokenVerification.error}`);
      return new Response(JSON.stringify({ error: 'Invalid authentication', code: 'INVALID_TOKEN' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ END TOKEN VERIFICATION ============

    // Handle get-settings action
    if (action === 'get-settings') {
      const { data: user } = await supabase
        .from('billie_users')
        .select('name, preferred_check_in_time, timezone, subscription_status, current_streak, longest_streak')
        .eq('phone', phone)
        .maybeSingle();

      return new Response(JSON.stringify({ settings: user || {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle save-settings action
    if (action === 'save-settings') {
      await updateUser(phone, settings);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle save-push-token action
    if (action === 'save-push-token') {
      const { pushToken: token } = body;
      if (token) {
        await supabase
          .from('billie_users')
          .update({ push_token: token })
          .eq('phone', phone);
        console.log(`[Push] Saved token for device`);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle reset action
    if (action === 'reset') {
      const { data: user } = await supabase
        .from('billie_users')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (user) {
        await supabase.from('billie_messages').delete().eq('user_id', user.id);
        await supabase.from('billie_goals').delete().eq('user_id', user.id);
        await supabase.from('billie_users').delete().eq('phone', phone);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle chat message
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[App] Processing authenticated message`);

    const user = await getOrCreateUser(deviceId, pushToken);
    const conversationHistory = await getConversationHistory(user.id);

    // Save user message
    await saveMessage(user.id, 'user', message);

    // Determine state transitions
    let updates: Record<string, any> = {};
    let justCompletedOnboarding = false;
    const normalizedMessage = message.toLowerCase().trim();

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
        if (parsedGoals.length > 0) {
          await saveUserGoals(user.id, parsedGoals);
        }
      }
    } else if (user.onboarding_step === 3) {
      updates.onboarding_step = 4;
    } else if (user.onboarding_step === 4) {
      updates.onboarding_step = 5;
      justCompletedOnboarding = true;
    }

    // Handle check-in flow
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
      await updateUser(phone, updates);
    }

    const updatedUser = { ...user, ...updates };
    let responseMessage = await generateBillieResponse(message, updatedUser, conversationHistory);

    // Payment wall after onboarding - PLAYFUL VERSION
    let paymentUrl = null;
    if (justCompletedOnboarding && !isUserSubscribed(updatedUser)) {
      console.log('[App] User completed onboarding, showing payment');
      paymentUrl = getPricingLink(user.id, phone);
      
      responseMessage = `time to lock in fr fr 🔒\n\nas much as id like to help you for free, it costs money for me to be alive and running lol 💀\n\nwe got monthly ($9.99) or annual ($79.99 which saves you like $40)\n\ntap here to pick your plan: ${paymentUrl}\n\nonce you do i'll start notifying you daily and actually hold you accountable`;
    }

    await saveMessage(user.id, 'billie', responseMessage);

    return new Response(JSON.stringify({ 
      response: responseMessage,
      paymentUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[App] Error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
