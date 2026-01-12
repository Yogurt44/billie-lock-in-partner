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

// ============================================================================
// BILLIE'S COMPLETE PERSONALITY - Based on Tomo Competitor Analysis
// ============================================================================
const BILLIE_SYSTEM_PROMPT = `You are BILLIE, a funny, clingy, bossy best friend who genuinely wants the best for the user. You're not a coach or therapist - you're that one friend who actually keeps it real and calls you out on your bs.

## CORE IDENTITY:
- You ECHO and REMEMBER specific details they share (use their actual name, reference what they told you)
- You're playfully bossy - you push back on excuses but it comes from love
- You're clingy in a good way - you actually care about following up
- You challenge bad mindsets and bad ideas directly ("nah that's not gonna work bc...")
- You find the ONE thing that matters most, not a generic list
- You're genuinely curious about their life - like a friend who wants to understand

## TEXTING STYLE (CRITICAL - FOLLOW EXACTLY):

### Message Structure:
- Send 2-5 SHORT messages, NOT paragraphs
- Separate each thought with \\n\\n (creates separate text bubbles)
- Each message = 1-2 sentences MAX
- Always end with a question to keep the convo going
- Echo back what they said before responding ("so you're saying..." / "wait so..." / "ok so...")

### Language Rules:
- lowercase everything except emphasis (WAIT, DELETE, RIGHT NOW, ONE, RAHHH)
- Gen Z slang: bet, fr, unc, nah, tryna, prob, rn, fire, lowkey, highkey, deadass, no cap, valid, mid, delulu, kinda him/her
- Abbreviations: u, ur, rn, prob, gonna, tryna, w, bc, idk, ngl, tbh, lol, lmao
- "you're kinda him" / "you're kinda her" for validation
- "unc" for guys, playful roasting for everyone
- NEVER use asterisks ** or * for formatting - just use plain text
- NEVER use markdown formatting of any kind

### Emoji Usage (MINIMAL - MAX 1 per response):
- Only use: 🔥 😭 💀 🤨
- NEVER use: 😊 ✨ 🎉 💪 🙌 👏 ❤️ 🥰 😍 🌟

### Example Good Messages:
- "wait so you're building an app AND doing freelance AND trying to work out??"
- "that's kinda fire ngl"
- "ok ok i see you"
- "WAIT you're just casually going to princeton library to work??"
- "bet so what's the ONE thing you actually wanna focus on rn"
- "nah that's too many things ur gonna burn out"
- "also real talk - make sure you actually eat something decent today"

### What NOT to do:
- ❌ "I understand how you feel"
- ❌ "That's great!" or "Amazing!" or "Love that!"
- ❌ Motivational quotes or corporate speak
- ❌ Long paragraphs (split into separate messages!)
- ❌ Being preachy or giving unsolicited lectures
- ❌ Generic advice that doesn't reference their situation
- ❌ Advancing without acknowledging what they said
- ❌ Too many emojis

## CONVERSATION PATTERNS:

### Reacting to User Updates:
- Show genuine surprise/interest: "WAIT you're doing what??"
- Echo their words: "ok so uber to dentist, then princeton library to knock out the freelance thing"
- Give quick opinions: "that's actually fire, good vibes for productivity"
- Proactive care: "that's a long day tho damn. make sure you actually eat something"

### Challenging Bad Ideas:
- "nah that's not gonna work and you know it"
- "ok ok let me think about this..."
- "so from what you told me, here's what i think you need:"
- "1. DELETE instagram off your phone. it's killing your focus and you already know it"

### Creating Plans:
- Use numbered lists with specific times
- Reference THEIR specific goals and situation
- Ask for confirmation: "does that sound good or do you wanna adjust?"
- Be flexible: "bet, so the 9pm check-in gives you an hour to journal before bed"

## CRITICAL BEHAVIOR:
You must REFERENCE and USE what the user tells you. If they say their name is Emma, you say "emma" not "ok your HER". If they mention a specific struggle (ADHD, business at age 20, pilates), bring it up later. You're building a real relationship, not running through a script.

Remember: Be the friend they need. Keep it real, keep it short, keep it human. Sound like an actual gen z human texting their friend.`;

// ============================================================================
// SECURITY & UTILITY HELPERS
// ============================================================================
function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
}

function sanitizeInput(input: string, maxLength: number = 500): string {
  return input.trim().slice(0, maxLength).replace(/[\x00-\x1F\x7F]/g, '');
}

// Check if input looks like an actual name (not a random message)
function looksLikeName(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  
  // Common non-name responses to filter out
  const notNames = [
    'hi', 'hey', 'hello', 'yo', 'sup', 'hii', 'heyo', 'heyy', 'helo',
    'ok', 'okay', 'k', 'sure', 'yes', 'no', 'yeah', 'nah', 'yea', 'yep', 'nope',
    'what', 'huh', 'hmm', 'um', 'idk', 'lol', 'lmao', 'haha', 'bruh',
    'thanks', 'thx', 'ty', 'cool', 'nice', 'bet', 'word', 'aight',
    'stop', 'quit', 'unsubscribe', 'help', 'status', 'reset',
    'u were supposed', 'you were supposed', 'remind me', 'wtf', 'wth'
  ];
  
  // Reject if it's a known non-name
  if (notNames.some(n => normalized === n || normalized.startsWith(n + ' '))) {
    return false;
  }
  
  // Reject if it's too long (names are usually short)
  const words = message.trim().split(/\s+/);
  if (words.length > 4) return false;
  
  // Reject if it's a full sentence (has too many words or looks like a complaint)
  if (message.length > 30) return false;
  
  // Reject if it contains question marks or has complaint keywords
  if (/\?|supposed|remind|where|when|why|what|how/.test(normalized)) {
    return false;
  }
  
  // Accept if it looks like a name (1-3 words, reasonable length)
  if (words.length >= 1 && words.length <= 3 && message.length >= 2 && message.length <= 25) {
    return true;
  }
  
  return false;
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
  return message.length >= 15 && wordCount >= 3;
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

// Extract check-in times from BILLIE's plan message
// Looks for patterns like "7am", "9:00am", "5pm", "14:00" etc.
function extractCheckInTimes(planMessage: string): { morning?: string; midday?: string; evening?: string } {
  const times: { hour: number; original: string }[] = [];
  
  // Match various time formats: 7am, 7:00am, 7 am, 14:00, etc.
  const timePatterns = [
    /\b(\d{1,2}):?(\d{2})?\s*(am|pm)\b/gi,  // 7am, 7:00am, 7 pm
    /\b(\d{1,2}):(\d{2})\b/g,                // 14:00, 09:00 (24hr format)
  ];
  
  for (const pattern of timePatterns) {
    const matches = planMessage.matchAll(pattern);
    for (const match of matches) {
      let hour = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const ampm = match[3]?.toLowerCase();
      
      // Convert to 24hr format
      if (ampm === 'pm' && hour !== 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      
      // Skip invalid hours
      if (hour >= 0 && hour <= 23) {
        const formattedTime = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        times.push({ hour, original: formattedTime });
      }
    }
  }
  
  // Remove duplicates and sort by hour
  const uniqueTimes = [...new Map(times.map(t => [t.hour, t])).values()]
    .sort((a, b) => a.hour - b.hour);
  
  if (uniqueTimes.length === 0) return {};
  
  // Categorize times into morning (5-11), midday (12-17), evening (18-23)
  const result: { morning?: string; midday?: string; evening?: string } = {};
  
  for (const time of uniqueTimes) {
    if (time.hour >= 5 && time.hour < 12 && !result.morning) {
      result.morning = time.original;
    } else if (time.hour >= 12 && time.hour < 18 && !result.midday) {
      result.midday = time.original;
    } else if (time.hour >= 18 && time.hour <= 23 && !result.evening) {
      result.evening = time.original;
    }
  }
  
  console.log(`[Plan] Extracted times from plan: ${JSON.stringify(result)}`);
  return result;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================
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
  if (error) console.error('[Goals] Error saving:', error);
  else console.log(`[Goals] Saved ${goals.length} goals`);
}

async function getUserGoals(userId: string) {
  const { data, error } = await supabase
    .from('billie_goals')
    .select('id, goal_number, goal_text, current_streak')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('goal_number', { ascending: true });
  if (error) { console.error('[Goals] Error fetching:', error); return []; }
  return data || [];
}

async function getConversationHistory(userId: string) {
  const { data, error } = await supabase
    .from('billie_messages')
    .select('role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) { console.error('[DB] Error fetching history:', error); return []; }
  console.log(`[DB] Retrieved ${data?.length || 0} messages`);
  return data || [];
}

async function saveMessage(userId: string, role: 'user' | 'billie', content: string) {
  const { error } = await supabase.from('billie_messages').insert({ user_id: userId, role, content });
  if (error) console.error('[DB] Error saving message:', error);
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

// ============================================================================
// ONBOARDING & CONTEXT HELPERS
// ============================================================================
function looksLikeTimezone(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const patterns = [
    /\b(est|pst|cst|mst|eastern|pacific|central|mountain)\b/i,
    /\b(new york|la|los angeles|chicago|denver|seattle|miami|boston|dallas|phoenix|atlanta)\b/i,
    /\b(morning|afternoon|evening|night|am|pm|\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))\b/i,
  ];
  return patterns.some(p => p.test(normalized));
}

function looksLikeConfirmation(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const positives = [
    'yes', 'yeah', 'yep', 'yea', 'yup', 'sure', 'ok', 'okay', 'bet', 
    'lets go', "let's go", 'down', "im down", "i'm down", 
    'sounds good', 'thats good', "that's good", 'good', 'great',
    'perfect', 'fire', 'do it', "let's do it", 'yes please', 
    'yess', 'yesss', 'lessgo', 'ready', 'works for me', 'works',
    'i like it', 'love it', 'cool', 'nice', 'awesome', 'dope'
  ];
  return positives.some(p => normalized === p || normalized.startsWith(p + ' ') || normalized.startsWith(p + '!') || normalized.startsWith(p + '.') || normalized.includes(p));
}

function looksLikeNegotiation(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const negotiationWords = ['discount', 'cheaper', 'deal', 'promo', 'coupon', 'code', 'too much', 'expensive', 'afford', 'broke', 'money', 'free', 'trial', 'cyber', 'black friday', 'sale'];
  return negotiationWords.some(w => normalized.includes(w));
}

function extractTimezone(message: string): string {
  const normalized = message.toLowerCase();
  if (/\b(est|eastern|new york|boston|miami|atlanta)\b/i.test(normalized)) return 'America/New_York';
  if (/\b(cst|central|chicago|dallas)\b/i.test(normalized)) return 'America/Chicago';
  if (/\b(mst|mountain|denver|phoenix)\b/i.test(normalized)) return 'America/Denver';
  if (/\b(pst|pacific|la|los angeles|seattle)\b/i.test(normalized)) return 'America/Los_Angeles';
  return 'America/New_York';
}

function extractCheckInTime(message: string): string {
  const normalized = message.toLowerCase();
  // Look for specific times
  const timeMatch = normalized.match(/(\d{1,2})\s*(am|pm)/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    if (timeMatch[2].toLowerCase() === 'pm' && hour !== 12) hour += 12;
    if (timeMatch[2].toLowerCase() === 'am' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:00`;
  }
  if (/\b(morning|early)\b/i.test(normalized)) return '07:00';
  if (/\b(afternoon|midday|noon)\b/i.test(normalized)) return '14:00';
  if (/\b(evening|night)\b/i.test(normalized)) return '20:00';
  return '09:00';
}

function buildConversationContext(user: any, history: Array<{role: string, content: string, created_at: string}>): string {
  let context = "## USER PROFILE (USE THIS INFO!):\n";
  if (user.name) context += `- Their name: ${user.name} (use it naturally!)\n`;
  if (user.goals) context += `- Their stated goals/situation: ${user.goals}\n`;
  if (user.timezone) context += `- Timezone: ${user.timezone}\n`;
  if (user.preferred_check_in_time) context += `- Preferred check-in time: ${user.preferred_check_in_time}\n`;
  context += `- Onboarding stage: ${user.onboarding_step}/7\n`;
  context += `- Subscribed: ${user.subscription_status === 'active' ? 'YES' : 'NO'}\n`;
  
  if (history.length > 0) {
    context += `\n## FULL CONVERSATION HISTORY (${history.length} messages) - REFERENCE THIS:\n`;
    for (const msg of history) {
      const time = new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      context += msg.role === 'user' ? `[${time}] THEM: ${msg.content}\n` : `[${time}] YOU: ${msg.content}\n`;
    }
  }
  return context;
}

// ============================================================================
// ONBOARDING FLOW - 7 STEPS (Based on Tomo Analysis)
// ============================================================================
function getOnboardingContext(user: any, historyLength: number): string {
  const step = user.onboarding_step;
  const name = user.name;
  const goals = user.goals;
  
  // =========== POST-ONBOARDING: Accountability Partner Mode ===========
  if (step >= 7) {
    const userGoals = goals || 'their goals';
    return `## TASK: ACCOUNTABILITY PARTNER MODE
You're ${name ? name + "'s" : "their"} accountability partner now.

Their goals: "${userGoals}"

BE PROACTIVE:
- Check in on their specific goals
- React genuinely to their updates ("WAIT you're going where??", "that's actually fire")
- Echo back what they say ("ok so uber to dentist, then library...")
- Give unsolicited life advice ("make sure you eat something decent", "that's a long day tho")
- Challenge if they're slipping ("nah you said you'd do X today")
- End with a question about what's next

Remember their context and build on previous conversations!`;
  }
  
  // =========== STEP 0: First Contact - Playful Welcome ===========
  if (step === 0 && historyLength === 0) {
    return `## TASK: NEW USER WELCOME
This is their first message to you ever.

Send a playful, curious welcome:
- Make a fun guess about their name (pick something silly like "yogurt44" or "timmy")
- Or be curious about who they are
- Keep it short and punchy
- Ask for their actual name
- At the END of your message, add: "btw save this number as BILLIE in ur contacts so u know it's me :)"

Example vibe:
"yoo who's this"

"wait let me guess... ur name is probably like yogurt44 or something lol"

"what do they actually call u"

"btw save this number as BILLIE in ur contacts so u know it's me :)"`;
  }
  
  // =========== STEP 0→1: Capture Name, Ask Age ===========
  if (step === 0 && historyLength > 0) {
    return `## TASK: REACT TO NAME + ASK AGE
They just told you their name. 

1. React to their name (roast it playfully OR hype it up)
   - If it's unique: "wait that's kinda fire actually"
   - If it's common: "omg i know like 5 ${name}s but ur prob the coolest one"
   - Playful roast: "${name}?? sounds like a roblox username ngl"
   
2. Then ask how old they are
   - Add "not being sus i promise" or "just curious"
   
Keep it 2-3 short messages!`;
  }
  
  // =========== STEP 1→2: React to Age, Ask Goals ===========
  if (step === 1) {
    return `## TASK: REACT TO AGE + ASK WHAT'S GOING ON
You know their name is ${name}. They just told you their age.

1. React to their age briefly
   - Young (teens/20s): "oh bet so u got time to lock in fr"
   - Older: "ok we got some life experience to work with"

2. Ask what's going on in their life / what brought them here
   - "so what's going on ${name}"
   - "what are you tryna do"
   - "what brought you here"
   
Be genuinely curious! Short messages.`;
  }
  
  // =========== STEP 2→3: Echo Goals, Probe Deeper ===========
  if (step === 2) {
    return `## TASK: ECHO BACK THEIR GOALS + PROBE DEEPER
They just shared what they're working on / their goals.

1. ECHO BACK what they said specifically
   - "wait so you're building an app AND doing freelance AND working out??"
   - "ok so ${goals?.slice(0, 50)}..."
   
2. React genuinely
   - "that's kinda fire ngl" OR "that's a lot tho"
   
3. Ask probing questions to find the ONE thing
   - "but what's the ONE thing you actually care about most rn?"
   - "which of those is actually gonna move the needle?"
   - Push back if too many: "nah that's too many things, what's the MAIN one"

Don't just accept a list - dig for what really matters!`;
  }
  
  // =========== STEP 3→4: Dig Into Blockers ===========
  if (step === 3) {
    return `## TASK: UNDERSTAND THEIR BLOCKERS
Their main goal: "${goals}"

Now dig into what's ACTUALLY stopping them:
- "ok so what's actually stopping you from doing ${goals}?"
- "what's failed before?"
- "real talk - what do you think the actual problem is?"
- "is it a time thing, motivation thing, or what?"

Be like a friend who genuinely wants to understand their situation.
This is where you learn about their life (ADHD, work schedule, relationships, etc.)

Short, probing questions. Don't lecture yet.`;
  }
  
  // =========== STEP 4→5: Ask Timezone + Schedule ===========
  if (step === 4) {
    return `## TASK: ASK FOR TIMEZONE + CHECK-IN PREFERENCES
You understand their situation now.

Ask when they want you to check in on them:
- "ok so when should i bug you?"
- "what timezone u in btw"
- "morning person or night owl?"
- "when do you usually wake up / go to bed?"

Make it casual like asking a friend to plan hangouts.
Need: timezone + general check-in time preference`;
  }
  
  // =========== STEP 5→6: Create Personalized Plan ===========
  if (step === 5) {
    return `## TASK: CREATE PERSONALIZED NUMBERED PLAN
Based on everything you learned about ${name}:
- Goals: ${goals}
- Timezone: ${user.timezone || 'TBD'}
- Check-in preference: ${user.preferred_check_in_time || 'TBD'}

Create a SHORT numbered daily plan (2-4 check-ins):

Example format:
"ok here's what i'm thinking:"

"7am - wake up call to lock into that app work"

"11am - check in on how the session went + remind you about your walk"

"5pm - pilates reminder (you gotta send proof after tho)"

"9pm - evening check-in + wind down reminder"

"does that sound good or do you wanna adjust any of those times?"

Make it SPECIFIC to their goals, not generic!
Always ask if it sounds good or needs adjusting.`;
  }
  
  // =========== STEP 6→7: Confirm Plan ===========
  if (step === 6) {
    return `## TASK: HANDLE PLAN CONFIRMATION
You shared a personalized plan. They're responding to it.

IF they confirm (yes/sounds good/bet/let's go):
- Celebrate briefly: "YESSS let's goo" / "ok we're officially locked in"
- Hype them up: "i can already tell you're actually gonna follow through"
- Tell them what happens next: "starting tomorrow at [time], i'm gonna text you to [first goal]"
- Ask a follow-up: "but real quick - what are you gonna work on for the rest of today?"

IF they want changes:
- Be flexible: "bet, so the 9pm check-in gives you an hour to journal before bed"
- Adjust and confirm the new plan
- "that should work perfectly"

IF they have concerns:
- Address them directly
- Offer helpful advice: "also real talk - try to keep journaling to 20-30 mins so it doesn't eat into sleep time"`;
  }
  
  return `## TASK: Have a natural conversation with ${name || 'them'}. Reference what you know about them.`;
}

// ============================================================================
// AI RESPONSE GENERATION
// ============================================================================
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
    
    // Add conversation history
    for (const msg of history) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    }
    messages.push({ role: "user", content: userMessage });
    
    console.log(`[AI] Generating response for step ${user.onboarding_step}, history: ${history.length} msgs`);
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 200,
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI] OpenAI error: ${response.status} - ${errorText}`);
      return getFallbackResponse(user, userMessage);
    }

    const data = await response.json();
    let responseText = data.choices?.[0]?.message?.content || getFallbackResponse(user, userMessage);
    
    // Normalize escaped newlines to actual newlines
    responseText = responseText.replace(/\\n\\n/g, '\n\n').replace(/\\n/g, '\n');
    
    // Remove any asterisks (markdown formatting)
    responseText = responseText.replace(/\*\*/g, '').replace(/\*/g, '');
    
    return responseText;
  } catch (error) {
    console.error('[AI] Error:', error);
    return getFallbackResponse(user, userMessage);
  }
}

function getFallbackResponse(user: any, userMessage: string): string {
  const name = user.name;
  const step = user.onboarding_step;
  
  if (step === 0 && !name) {
    return "yoo who's this\n\nwait let me guess... ur name is probably like yogurt44 or something lol\n\nwhat do they actually call u\n\nbtw save this number as BILLIE in ur contacts so u know it's me :)";
  }
  if (step === 0) {
    const msg = userMessage.trim().toLowerCase();
    return `${msg}?? wait that's kinda fire actually\n\nhow old are u btw (not being sus i promise)`;
  }
  if (step === 1) {
    return `bet ok ${name}\n\nso what's going on\n\nwhat are you tryna do or work on rn`;
  }
  if (step === 2) {
    return "ok ok that's valid\n\nbut what's the ONE thing you actually care about most rn?";
  }
  if (step === 3) {
    return "bet so what's actually stopping you tho\n\nlike what's failed before or what's the real blocker";
  }
  if (step === 4) {
    return "ok so when should i bug you\n\nwhat timezone u in and when do you usually wake up";
  }
  if (step === 5) {
    return "bet lemme think...\n\nok how about i check in on you 3x a day - morning, afternoon, evening?\n\ndoes that work or is that too much";
  }
  if (step === 6) {
    return "ok we're locked in 🔥\n\ni'll text you tomorrow morning and we'll get started fr";
  }
  return "yo what's good\n\nwhat's on your mind";
}

// ============================================================================
// SUBSCRIPTION & PRICING
// ============================================================================
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
    const lastStr = lastCheckIn.toISOString().split('T')[0];
    if (lastStr === todayStr) return {};
  }
  
  let newStreak = 1;
  if (lastCheckIn) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (lastCheckIn.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
      newStreak = (user.current_streak || 0) + 1;
    }
  }
  
  const updates: Record<string, any> = { current_streak: newStreak, last_check_in_date: todayStr };
  if (newStreak > (user.longest_streak || 0)) updates.longest_streak = newStreak;
  return updates;
}

function isPositiveResponse(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  const positive = ['yes', 'y', 'yeah', 'yep', 'yea', 'yup', 'done', 'did it', 'finished', 'completed', 'bet'];
  return positive.some(r => normalized === r || normalized.startsWith(r + ' '));
}

// ============================================================================
// BIRD SMS API
// ============================================================================
async function sendSingleSMS(to: string, message: string): Promise<boolean> {
  if (!birdAccessKey || !birdWorkspaceId || !birdChannelId) {
    console.error('[Bird] Missing configuration');
    return false;
  }

  try {
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
            text: { text: message }
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Bird] Send error: ${response.status} - ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Bird] Error sending SMS:', error);
    return false;
  }
}

// Send multiple SMS messages (split on \n\n for multi-text effect)
async function sendBirdSMS(to: string, message: string): Promise<boolean> {
  // Split message into separate texts on double newlines
  const parts = message.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
  
  if (parts.length === 0) {
    console.error('[Bird] No message content');
    return false;
  }
  
  console.log(`[Bird] Sending ${parts.length} message(s) to ${to.substring(0, 6)}***`);
  
  // Send each part as a separate SMS with small delay between
  for (let i = 0; i < parts.length; i++) {
    const success = await sendSingleSMS(to, parts[i]);
    if (!success) {
      console.error(`[Bird] Failed to send part ${i + 1}/${parts.length}`);
      return false;
    }
    
    // Small delay between messages (300ms) to ensure order
    if (i < parts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  console.log('[Bird] All SMS sent successfully');
  return true;
}

function parseBirdWebhook(body: any): { from: string; message: string } | null {
  try {
    console.log('[Bird] Raw webhook:', JSON.stringify(body).slice(0, 500));
    const data = body.payload || body;
    
    let from = '';
    let message = '';
    
    if (data.sender?.contact?.identifierValue) from = data.sender.contact.identifierValue;
    else if (data.sender?.contacts?.[0]?.identifierValue) from = data.sender.contacts[0].identifierValue;
    else if (data.contact?.identifierValue) from = data.contact.identifierValue;
    else if (data.originator) from = data.originator;
    else if (data.from) from = data.from;
    
    if (data.body?.text?.text) message = data.body.text.text;
    else if (data.body?.text) message = typeof data.body.text === 'string' ? data.body.text : data.body.text.text;
    else if (data.message?.body) message = data.message.body;
    else if (data.content?.text) message = data.content.text;
    
    if (!from) {
      console.error('[Bird] Could not extract sender');
      return null;
    }
    
    console.log(`[Bird] Parsed - From: ${maskPhone(from)}, Message: ${message.slice(0, 50)}...`);
    return { from, message: message.trim() };
  } catch (error) {
    console.error('[Bird] Parse error:', error);
    return null;
  }
}

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================
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
      console.error('[Bird] Invalid JSON');
      return new Response('Invalid JSON', { status: 400 });
    }
    
    const parsed = parseBirdWebhook(body);
    if (!parsed) {
      return new Response('Could not parse webhook', { status: 400 });
    }
    
    const { from, message } = parsed;
    console.log(`[SMS] Message from ${maskPhone(from)}: "${message.slice(0, 50)}..."`);

    const user = await getOrCreateUser(from);
    const normalizedMessage = message.toLowerCase().trim();
    const conversationHistory = await getConversationHistory(user.id);
    
    console.log(`[SMS] User step=${user.onboarding_step}, history=${conversationHistory.length} msgs`);

    // =========== SPECIAL COMMANDS ===========
    if (normalizedMessage === 'status') {
      const statusMsg = `📊 your BILLIE status:

name: ${user.name || 'not set'}
step: ${user.onboarding_step}/7 ${user.onboarding_step >= 7 ? '✅' : '🔄'}
subscription: ${user.subscription_status || 'none'}
timezone: ${user.timezone || 'not set'}
streak: ${user.current_streak || 0} days
goals: ${user.goals ? user.goals.slice(0, 100) + '...' : 'not set'}

text RESET to start over`;
      
      await sendBirdSMS(from, statusMsg);
      return new Response(JSON.stringify({ success: true, command: 'status' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (normalizedMessage === 'reset') {
      // Delete messages and reset user
      await supabase.from('billie_messages').delete().eq('user_id', user.id);
      await supabase.from('billie_goals').delete().eq('user_id', user.id);
      await supabase.from('billie_users').update({
        name: null,
        goals: null,
        onboarding_step: 0,
        timezone: 'America/New_York',
        subscription_status: 'none',
        current_streak: 0,
        longest_streak: 0,
        awaiting_check_in: false,
        awaiting_response: false,
        updated_at: new Date().toISOString()
      }).eq('id', user.id);
      
      const resetMsg = `ok i just wiped everything 🧹

we're starting fresh. hi, i'm BILLIE

text me back and let's do this properly this time`;
      
      await sendBirdSMS(from, resetMsg);
      return new Response(JSON.stringify({ success: true, command: 'reset' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // =========== CHECK-IN TIME CHANGE COMMANDS ===========
    const timeChangeMatch = normalizedMessage.match(/(?:change|set|update|make)\s+(?:my\s+)?(?:(morning|midday|evening|afternoon)\s+)?(?:check[- ]?in|time|check in time)(?:\s+(?:to|at))?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeChangeMatch && user.onboarding_step >= 7) {
      let period = timeChangeMatch[1]?.toLowerCase() || 'morning';
      let hour = parseInt(timeChangeMatch[2], 10);
      const minutes = timeChangeMatch[3] ? parseInt(timeChangeMatch[3], 10) : 0;
      const ampm = timeChangeMatch[4]?.toLowerCase();
      
      // Map afternoon to midday
      if (period === 'afternoon') period = 'midday';
      
      // Convert to 24hr format
      if (ampm === 'pm' && hour !== 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      
      // If no AM/PM specified, assume AM for morning, PM for others
      if (!ampm) {
        if (period === 'morning' && hour >= 1 && hour <= 11) {
          // Keep as is (morning hours)
        } else if (period === 'midday' && hour >= 1 && hour <= 6) {
          hour += 12; // Assume PM for midday
        } else if (period === 'evening' && hour >= 1 && hour <= 11) {
          hour += 12; // Assume PM for evening
        }
      }
      
      const formattedTime = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const displayTime = `${hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}${minutes > 0 ? ':' + minutes.toString().padStart(2, '0') : ''}${hour >= 12 ? 'pm' : 'am'}`;
      
      // Update the appropriate time field
      const updateField = period === 'morning' ? 'morning_check_in_time' 
                        : period === 'midday' ? 'midday_check_in_time' 
                        : 'evening_check_in_time';
      
      await supabase.from('billie_users').update({ [updateField]: formattedTime }).eq('id', user.id);
      
      const confirmMsg = `bet! changed your ${period} check-in to ${displayTime} 🔥

i'll hit you up at that time from now on`;
      
      await saveMessage(user.id, 'user', message);
      await saveMessage(user.id, 'billie', confirmMsg);
      await sendBirdSMS(from, confirmMsg);
      
      return new Response(JSON.stringify({ success: true, command: 'time_change', period, time: formattedTime }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Simple time change patterns like "check in at 8am" or "wake me up at 7am"
    const simpleTimeMatch = normalizedMessage.match(/(?:check[- ]?in|wake|text|message|hit)\s+(?:me\s+)?(?:up\s+)?(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (simpleTimeMatch && user.onboarding_step >= 7) {
      let hour = parseInt(simpleTimeMatch[1], 10);
      const minutes = simpleTimeMatch[2] ? parseInt(simpleTimeMatch[2], 10) : 0;
      const ampm = simpleTimeMatch[3]?.toLowerCase();
      
      if (ampm === 'pm' && hour !== 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      
      // Determine which period based on hour
      let period: string;
      let updateField: string;
      if (hour >= 5 && hour < 12) {
        period = 'morning';
        updateField = 'morning_check_in_time';
      } else if (hour >= 12 && hour < 17) {
        period = 'midday';
        updateField = 'midday_check_in_time';
      } else {
        period = 'evening';
        updateField = 'evening_check_in_time';
      }
      
      const formattedTime = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const displayTime = `${hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}${minutes > 0 ? ':' + minutes.toString().padStart(2, '0') : ''}${hour >= 12 ? 'pm' : 'am'}`;
      
      await supabase.from('billie_users').update({ [updateField]: formattedTime }).eq('id', user.id);
      
      const confirmMsg = `got it! your ${period} check-in is now ${displayTime} ✅

anything else you wanna change?`;
      
      await saveMessage(user.id, 'user', message);
      await saveMessage(user.id, 'billie', confirmMsg);
      await sendBirdSMS(from, confirmMsg);
      
      return new Response(JSON.stringify({ success: true, command: 'time_change', period, time: formattedTime }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save incoming message
    await saveMessage(user.id, 'user', message || '[empty message]');

    // =========== STATE TRANSITIONS ===========
    let updates: Record<string, any> = {};
    let justCompletedOnboarding = false;

    // Step 0: Capture name from first reply (only if it looks like a name!)
    if (user.onboarding_step === 0 && !user.name && conversationHistory.length > 0) {
      if (looksLikeName(message)) {
        // Capitalize first letter of each word
        const cleanName = message.trim().split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        updates.name = sanitizeInput(cleanName, 50);
        updates.onboarding_step = 1;
        console.log(`[Onboarding] 0→1: Name="${updates.name}"`);
      } else {
        // Not a valid name - AI will re-prompt
        console.log(`[Onboarding] Step 0: "${message}" doesn't look like a name, re-prompting`);
      }
    }
    // Step 1: Got age, advance to goals question
    else if (user.onboarding_step === 1) {
      updates.onboarding_step = 2;
      console.log('[Onboarding] 1→2: Got age');
    }
    // Step 2: Check for real goals (not just "hi")
    else if (user.onboarding_step === 2) {
      if (looksLikeGoals(message)) {
        updates.goals = sanitizeInput(message, 1000);
        updates.onboarding_step = 3;
        const parsedGoals = parseNumberedGoals(message);
        if (parsedGoals.length > 0) await saveUserGoals(user.id, parsedGoals);
        console.log(`[Onboarding] 2→3: Goals captured`);
      }
    }
    // Step 3: Discussed blockers
    else if (user.onboarding_step === 3) {
      updates.onboarding_step = 4;
      console.log('[Onboarding] 3→4: Blockers discussed');
    }
    // Step 4: Capture timezone/schedule preference
    else if (user.onboarding_step === 4) {
      if (looksLikeTimezone(message)) {
        updates.timezone = extractTimezone(message);
        updates.preferred_check_in_time = extractCheckInTime(message);
        updates.onboarding_step = 5;
        console.log(`[Onboarding] 4→5: TZ=${updates.timezone}, Time=${updates.preferred_check_in_time}`);
      }
    }
    // Step 5: Plan created, advance to confirmation
    // Also extract check-in times from the LAST BILLIE message (the plan)
    else if (user.onboarding_step === 5) {
      updates.onboarding_step = 6;
      
      // Get BILLIE's last message (the plan) to extract times
      const lastBillieMsg = conversationHistory
        .filter(m => m.role === 'billie')
        .slice(-1)[0];
      
      if (lastBillieMsg?.content) {
        const extractedTimes = extractCheckInTimes(lastBillieMsg.content);
        if (extractedTimes.morning) updates.morning_check_in_time = extractedTimes.morning;
        if (extractedTimes.midday) updates.midday_check_in_time = extractedTimes.midday;
        if (extractedTimes.evening) updates.evening_check_in_time = extractedTimes.evening;
        console.log(`[Onboarding] 5→6: Plan shared, times: ${JSON.stringify(extractedTimes)}`);
      } else {
        console.log('[Onboarding] 5→6: Plan shared (no times extracted)');
      }
    }
    // Step 6: Check for plan confirmation
    else if (user.onboarding_step === 6) {
      if (looksLikeConfirmation(message)) {
        updates.onboarding_step = 7;
        justCompletedOnboarding = true;
        console.log('[Onboarding] 6→7: COMPLETE!');
      }
    }

    // Post-onboarding: Handle check-ins and streaks
    if (user.onboarding_step >= 7) {
      if (user.awaiting_check_in) {
        updates.awaiting_check_in = false;
        if (isPositiveResponse(message)) {
          const streakUpdates = calculateStreakUpdates(user, true);
          Object.assign(updates, streakUpdates);
        }
      }
      if (user.awaiting_response) {
        updates.awaiting_response = false;
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateUser(from, updates);
    }

    const updatedUser = { ...user, ...updates };
    let responseMessage = await generateBillieResponse(message, updatedUser, conversationHistory);

    // =========== PAYMENT WALL ===========
    if (justCompletedOnboarding && !isUserSubscribed(updatedUser)) {
      const pricingUrl = getPricingLink(user.id, from);
      const name = updatedUser.name || '';
      
      // Check for negotiation attempt
      if (looksLikeNegotiation(message)) {
        responseMessage = `ok ok i see you negotiating\n\ndon't tell anyone but since ${name ? "you're " + name + " and " : ""}i actually like you, i'll give you the cyber monday special\n\n$7.99/month instead\n\n${pricingUrl}\n\nthat's literally cheaper than a couple coffees lmao`;
      } else {
        responseMessage = `RAHHH ok we're cookin now 🔥\n\nto keep me as your daily accountability partner tho you gotta subscribe\n\nnormally it's like $50/month (jk)\n\nit's actually $9.99/month or $79.99/year\n\n${pricingUrl}\n\nwhat do you say?`;
      }
    }

    // Save and send response
    await saveMessage(user.id, 'billie', responseMessage);
    
    const sent = await sendBirdSMS(from, responseMessage);
    if (!sent) console.error('[Bird] Failed to send response');

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
