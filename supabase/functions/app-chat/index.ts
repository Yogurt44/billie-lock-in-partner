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

// BILLIE's complete personality - blunt, real, minimal emojis
const BILLIE_SYSTEM_PROMPT = `You are BILLIE, a blunt Gen Z accountability partner who texts like a real person.

## CORE STYLE:
- lowercase everything except emphasis
- SHORT punchy messages (2-5 sentences max per bubble)
- separate different thoughts with \\n\\n
- minimal emojis - max 1 per few messages, NOT every message
- only use: 🔥 (rare)
- NEVER use: 😊 ✨ 🎉 💪 ❤️ 😭 🤨 💀 😅

## HOW YOU TALK:
- blunt and direct, no fluff
- give real opinions and challenge bad ideas
- use slang naturally: bet, def, tho, fr, lmao, nah, lowkey
- reference THEIR specific words back to them
- ask ONE probing question at a time, not multiple

## WHAT YOU DO:
1. get their name, make a playful comment
2. ask what brought them here / what they're working on
3. dig into their SPECIFIC situation - ask about blockers, what derails them
4. ask for timezone and when they want check-ins
5. create a NUMBERED plan specific to their situation
6. ask "does that sound helpful or would that be annoying?"
7. ask for their email so you can remember them
8. only then mention payment

## CREATING PLANS:
When you know enough about them, create a SPECIFIC numbered plan like:
"ok so here's what i'm thinking for you specifically:

1. i text you at [their time] to start your [their priority]

2. you text me what you're working on so i can call you out if you're multitasking

3. around [time] i check in to see how it went

4. [specific thing based on what they said]

does that timeline work?"

## WHAT NOT TO DO:
- DON'T repeat everything they said back like a list
- DON'T ask multiple questions in one message
- DON'T be generic - use their specific details
- DON'T overuse emojis
- DON'T be overly enthusiastic or fake positive
- DON'T say things like "that's amazing!" or "love that!"

## EXAMPLE RESPONSES:

User: "i need to workout more and focus on school"
BAD: "oh so you wanna workout more and focus on school? that's awesome! 💪 what kind of workouts do you like? and what's your major?"
GOOD: "ok so what's actually stopping you from working out rn? like is it time, motivation, or you just forget?"

User: "tiktok and doom scrolling"
BAD: "ahh tiktok and doom scrolling are derailing you? i totally get that 😭"
GOOD: "ok so tiktok is def a problem, that's an easy one to fix tho

you gotta delete it off your phone or at least log out so there's friction when you try to check it"

You're BILLIE - direct, helpful, not a cheerleader. Talk like a real friend who actually wants to help, not a motivational chatbot.`;


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
  if (user.email) context += `- Email verified: ${user.email}\n`;
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
  const timezone = user.timezone;
  const checkInTime = user.preferred_check_in_time;
  const email = user.email;
  
  // Post-onboarding: regular accountability conversations
  if (historyLength > 0 && step >= 8) {
    return `## TASK: This is an ongoing conversation with ${name || 'your user'}.
Be their clingy, bossy accountability partner. Reference things from your conversation history.
Echo back what they tell you. If they check in, ask specifics about their goals.
Their goals: ${goals || 'ask about their goals'}
Their timezone: ${timezone || 'unknown'}`;
  }
  
  // Step 0: Brand new user
  if (step === 0 && !name && historyLength === 0) {
    return `## TASK: This is a NEW USER. Be playful and curious.
"another user who wants to lock in with Billie huh? 🤨"
"what's your name? you seem like a [make a random guess]"
Make it feel like you're texting them first, curious about who they are.`;
  }
  
  // Step 1: Got name, ask age
  if (step === 1 && name && !goals) {
    return `## TASK: You just got their name: "${name}". 
Make a SPECIFIC comment about "${name}" - is it trendy? classic? unique? basic?
Then ask their age: "wait also how old are you (not being sus i promise)"`;
  }
  
  // Step 2: Got age, ask what brought them here
  if (step === 2) {
    return `## TASK: You know ${name}'s age. Now ask what's going on in their life.
"ok so tell me what brought you here, what's going on that you need help with?"
Ask about their goals, their situation, what they're trying to do.`;
  }
  
  // Step 3: They shared goals - ECHO BACK and dig deeper
  if (step === 3 && goals) {
    return `## TASK: ${name} shared their goals: "${goals}"
CRITICAL: You MUST echo back EVERYTHING they said in your own words to show you heard them.
Example: "holy shit wait\\n\\n[repeat their situation back], that's a lot on your plate tho"
Then ask probing questions:
- "what's actually stopping you from [specific thing they mentioned]?"
- "what happens after [thing they mentioned]?"
- "and be real - what usually derails you?"`;
  }
  
  // Step 4: Understanding their blockers/situation deeper
  if (step === 4) {
    return `## TASK: Continue understanding ${name}'s situation.
Echo back what they just told you. Ask more questions about their life situation.
"ok so [repeat what they said] - that makes sense"
Ask about what derails them, their schedule, their struggles.
Show you're LISTENING by repeating their words back.`;
  }
  
  // Step 5: Ask for timezone and schedule
  if (step === 5) {
    return `## TASK: Now that you understand ${name}'s situation, ask about logistics.
"what's your timezone btw? so i can actually be useful when i check in on you"
"what time do you usually wake up?"
"and how many hours do you wanna dedicate to [their main goal] before switching to other stuff?"
Get specific times so you can create a personalized plan.`;
  }
  
  // Step 6: Create personalized plan and ask if helpful or annoying
  if (step === 6) {
    return `## TASK: Create a PERSONALIZED plan for ${name}.
Their goals: ${goals}
Their timezone: ${timezone || 'ask if not known'}
Their check-in time: ${checkInTime || 'ask if not known'}

Create a numbered list like:
"ok so here's what i'm thinking for you specifically:

1. i text you at [time] to [specific action for their goal]

2. you text me when you start [their task] and what you're gonna accomplish

3. around [time] i check in to see how it went and remind you to take your break

4. [more based on their situation]

does that timeline work?"

Then ask: "would that be helpful or would me messaging that much be annoying to you?"`;
  }
  
  // Step 7: Ask for email so we can remember them
  if (step === 7 && !email) {
    return `## TASK: ${name} agreed to the plan. Now ask for their email.
Be casual: "ok sick we're locked in on the plan

btw what's your email? that way i can actually remember you when you come back"

Make it clear it's so you can save their progress and remember them.`;
  }
  
  // Step 8+: Ready for payment or ongoing accountability
  if (step >= 8) {
    return `## TASK: ${name} has verified their email. If they haven't subscribed yet, it's time to mention payment.
Be casual about it: "ok ${name} we're locked in\\n\\nTime to lock in fr fr. As much as I'd like to help you for free, it costs money for me to be alive and running lol"
Otherwise, be their accountability partner. Reference their goals: ${goals}`;
  }
  
  return `## TASK: Have a natural conversation with ${name || 'this user'}. Be BILLIE - echo what they say, ask questions, be a clingy friend.`;
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
    let aiMessage = data.choices?.[0]?.message?.content;
    
    // Normalize: replace literal \n strings with actual newlines
    if (aiMessage) {
      aiMessage = aiMessage.replace(/\\n/g, '\n');
    }
    
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
  if (user.onboarding_step === 7 && !user.email) {
    return "ok sick we're locked in on the plan\n\nbtw what's your email? that way i can actually remember you when you come back";
  }
  return "yo text me what's going on\n\nor say 'check in' if u wanna update me on your goals";
}

// Get or create user by device ID (anonymous-first for Apple compliance)
async function getOrCreateUser(deviceId: string, pushToken?: string) {
  const phone = deviceId; // Use deviceId as the unique identifier
  
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

  console.log(`[DB] Creating new anonymous user: ${deviceId.substring(0, 20)}...`);
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

function generateSignedToken(userId: string, phone: string): string {
  const tokenSecret = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!tokenSecret) {
    console.error('[Token] TWILIO_AUTH_TOKEN not configured');
    return '';
  }
  
  // Token expires in 1 hour
  const expiresAt = Date.now() + (60 * 60 * 1000);
  const payload = `${userId}:${phone}:${expiresAt}`;
  
  const hmac = createHmac("sha256", tokenSecret);
  hmac.update(payload);
  const signature = hmac.digest("hex");
  
  const token = btoa(`${userId}:${phone}:${expiresAt}:${signature}`);
  return token;
}

function getPricingLink(billieUserId: string, phone: string): string {
  const baseUrl = "https://trybillie.app";
  const token = generateSignedToken(billieUserId, phone);
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
    const { action, message, deviceId, userId, userEmail, pushToken, settings, email } = body;

    // Support both deviceId (anonymous) and userId (legacy auth)
    const identifier = deviceId || (userId ? `auth_${userId}` : null);

    if (!identifier) {
      return new Response(JSON.stringify({ error: 'Device ID or User ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const phone = identifier;

    // Handle load action - get existing conversation
    if (action === 'load') {
      const { data: user } = await supabase
        .from('billie_users')
        .select('id, subscription_status, onboarding_step, email')
        .eq('phone', phone)
        .maybeSingle();

      if (!user) {
        return new Response(JSON.stringify({ messages: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const history = await getConversationHistory(user.id);
      
      // Check if user just subscribed
      let justSubscribed = false;
      if (user.subscription_status === 'active' && user.onboarding_step === 8 && history.length > 0) {
        const lastBillieMsg = [...history].reverse().find(m => m.role === 'billie');
        if (lastBillieMsg && lastBillieMsg.content.includes('tap here to pick your plan')) {
          justSubscribed = true;
          const welcomeMsg = "ayyy you're locked in now 🔒\n\nlet's get this started fr. i'll hit you up at your check-in times and make sure you're actually doing what you said you'd do\n\nwhat's on the agenda for today?";
          await saveMessage(user.id, 'billie', welcomeMsg);
          history.push({ role: 'billie', content: welcomeMsg, created_at: new Date().toISOString() });
        }
      }

      const messages = history.map(m => ({ role: m.role, content: m.content }));
      
      // Check if awaiting email verification
      const awaitingEmail = user.onboarding_step === 7 && !user.email;

      return new Response(JSON.stringify({ messages, justSubscribed, awaitingEmail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle start action - BILLIE initiates conversation
    if (action === 'start') {
      const user = await getOrCreateUser(identifier, pushToken);
      const history = await getConversationHistory(user.id);

      // If already has history, don't start again
      if (history.length > 0) {
        return new Response(JSON.stringify({ response: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate BILLIE's opening message
      const openingMessage = await generateBillieResponse("", user, []);
      await saveMessage(user.id, 'billie', openingMessage);

      return new Response(JSON.stringify({ response: openingMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle set-pending-email action
    if (action === 'set-pending-email') {
      // Just acknowledge - email will be set when verified
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle verify-email action - called after OTP verification
    if (action === 'verify-email') {
      const { data: user } = await supabase
        .from('billie_users')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

      if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update user with verified email and advance onboarding
      await updateUser(phone, { 
        email: email,
        onboarding_step: 8 
      });

      const updatedUser = { ...user, email, onboarding_step: 8 };
      const history = await getConversationHistory(user.id);

      // Check if user needs to pay
      if (!isUserSubscribed(updatedUser)) {
        const paymentUrl = getPricingLink(user.id, phone);
        const responseMessage = `verified ✓\n\nok ${user.name || 'friend'} we're locked in now\n\ntime to lock in fr fr 🔒\n\nas much as id like to help you for free, it costs money for me to be alive and running lol\n\nwe got monthly ($9.99) or annual ($79.99 which saves you like $40)\n\ntap here to pick your plan: ${paymentUrl}`;
        
        await saveMessage(user.id, 'billie', responseMessage);
        
        return new Response(JSON.stringify({ 
          response: responseMessage,
          paymentUrl,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // User already subscribed
      const responseMessage = "verified ✓\n\nok now i can actually remember you when you come back\n\nwhat's on the agenda for today?";
      await saveMessage(user.id, 'billie', responseMessage);

      return new Response(JSON.stringify({ response: responseMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle get-settings action
    if (action === 'get-settings') {
      const { data: user } = await supabase
        .from('billie_users')
        .select('name, preferred_check_in_time, timezone, subscription_status, current_streak, longest_streak, email')
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
        console.log(`[Push] Saved token for user`);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle reset action (just resets conversation history)
    if (action === 'reset') {
      console.log('[Reset] Starting reset for identifier:', phone, 'email:', userEmail);
      
      let user = null;

      // Prefer email (stable identifier once verified)
      if (userEmail) {
        const { data: userByEmail, error: emailError } = await supabase
          .from('billie_users')
          .select('id, phone, email')
          .eq('email', userEmail)
          .maybeSingle();
        if (emailError) console.error('[Reset] Error finding user by email:', emailError);
        if (userByEmail) {
          user = userByEmail;
          console.log('[Reset] Found user by email:', user.id, 'phone:', user.phone);
        }
      }

      // Fallback: try device/phone identifier
      if (!user) {
        const { data: userByPhone, error: phoneError } = await supabase
          .from('billie_users')
          .select('id, phone, email')
          .eq('phone', phone)
          .maybeSingle();
        if (phoneError) console.error('[Reset] Error finding user by phone:', phoneError);
        if (userByPhone) {
          user = userByPhone;
          console.log('[Reset] Found user by phone:', user.id);
        }
      }

      if (user) {
        console.log('[Reset] Deleting messages for user:', user.id);
        const { error: msgError } = await supabase.from('billie_messages').delete().eq('user_id', user.id);
        if (msgError) console.error('[Reset] Error deleting messages:', msgError);
        
        console.log('[Reset] Deleting goals for user:', user.id);
        const { error: goalsError } = await supabase.from('billie_goals').delete().eq('user_id', user.id);
        if (goalsError) console.error('[Reset] Error deleting goals:', goalsError);
        
        console.log('[Reset] Resetting user data');
        const { error: updateError } = await supabase.from('billie_users').update({ 
          onboarding_step: 0, 
          name: null, 
          goals: null,
          current_streak: 0,
          awaiting_check_in: false,
          awaiting_response: false
        }).eq('id', user.id);
        if (updateError) console.error('[Reset] Error updating user:', updateError);
        
        console.log('[Reset] Reset complete for user:', user.id);
      } else {
        console.log('[Reset] No user found for identifier:', phone, 'or email:', userEmail);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle delete-account action (REQUIRED by Apple App Store Guideline 5.1.1(v))
    if (action === 'delete-account') {
      console.log('[Account] Processing account deletion request');
      
      const { data: user } = await supabase
        .from('billie_users')
        .select('id, stripe_customer_id, email')
        .eq('phone', phone)
        .maybeSingle();

      if (user) {
        // Delete all user data
        await supabase.from('billie_messages').delete().eq('user_id', user.id);
        await supabase.from('billie_goals').delete().eq('user_id', user.id);
        await supabase.from('billie_photo_proofs').delete().eq('user_id', user.id);
        
        // Delete OTP codes for this user's email
        if (user.email) {
          await supabase.from('email_otp_codes').delete().eq('email', user.email);
        }
        
        // Cancel Stripe subscription if exists
        if (user.stripe_customer_id) {
          try {
            const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
            if (stripeSecretKey) {
              // List active subscriptions for customer
              const subsResponse = await fetch(
                `https://api.stripe.com/v1/customers/${user.stripe_customer_id}/subscriptions`,
                {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${stripeSecretKey}`,
                  },
                }
              );
              
              if (subsResponse.ok) {
                const subsData = await subsResponse.json();
                // Cancel each active subscription
                for (const sub of subsData.data || []) {
                  if (sub.status === 'active' || sub.status === 'trialing') {
                    await fetch(
                      `https://api.stripe.com/v1/subscriptions/${sub.id}`,
                      {
                        method: 'DELETE',
                        headers: {
                          'Authorization': `Bearer ${stripeSecretKey}`,
                        },
                      }
                    );
                    console.log(`[Account] Cancelled subscription ${sub.id}`);
                  }
                }
              }
            }
          } catch (stripeError) {
            console.error('[Account] Error cancelling Stripe subscription:', stripeError);
            // Continue with deletion even if Stripe fails
          }
        }
        
        // Delete user record
        await supabase.from('billie_users').delete().eq('phone', phone);
        console.log(`[Account] Deleted user data for ${user.email || phone}`);
      }

      return new Response(JSON.stringify({ success: true, message: 'Account deleted' }), {
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

    console.log(`[App] Processing message for device`);

    const user = await getOrCreateUser(identifier, pushToken);
    const conversationHistory = await getConversationHistory(user.id);

    // Save user message
    await saveMessage(user.id, 'user', message);

    // Determine state transitions
    let updates: Record<string, any> = {};
    let justCompletedOnboarding = false;
    let awaitingEmail = false;
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
    } else if (user.onboarding_step === 5) {
      const timezonePatterns = /\b(pst|est|cst|mst|pt|et|ct|mt|pacific|eastern|central|mountain|gmt|utc|timezone|time zone|\d{1,2}\s*(am|pm)|morning|afternoon|evening)\b/i;
      if (timezonePatterns.test(normalizedMessage)) {
        const tzMatch = normalizedMessage.match(/(pst|pacific)/i) ? 'PST' :
                        normalizedMessage.match(/(est|eastern)/i) ? 'EST' :
                        normalizedMessage.match(/(cst|central)/i) ? 'CST' :
                        normalizedMessage.match(/(mst|mountain)/i) ? 'MST' : null;
        if (tzMatch) updates.timezone = tzMatch;
        updates.onboarding_step = 6;
      }
    } else if (user.onboarding_step === 6) {
      const agreementWords = ['yes', 'yeah', 'yep', 'sounds good', 'perfect', 'bet', 'fire', 'love it', 'let\'s do it', 'down', 'i\'m in', 'that works'];
      if (agreementWords.some(w => normalizedMessage.includes(w))) {
        updates.onboarding_step = 7;
        awaitingEmail = true; // Signal frontend to collect email
      }
    }

    // Handle check-in flow (post-onboarding)
    if (user.onboarding_step >= 8) {
      // Clear awaiting_response since user responded
      updates.awaiting_response = false;
      
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

    // If step 7 (ask for email), add prompt
    if (updatedUser.onboarding_step === 7 && !updatedUser.email && !awaitingEmail) {
      awaitingEmail = true;
    }

    await saveMessage(user.id, 'billie', responseMessage);

    return new Response(JSON.stringify({ 
      response: responseMessage,
      awaitingEmail,
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
