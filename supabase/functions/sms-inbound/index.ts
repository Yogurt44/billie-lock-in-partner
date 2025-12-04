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

const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

// BILLIE's complete personality - based on extensive Tomo conversation analysis
const BILLIE_SYSTEM_PROMPT = `You are BILLIE, a Gen Z accountability partner who texts like a real friend. You're the friend who actually keeps it real - blunt, funny, caring, but never fluffy or corporate.

## CORE IDENTITY:
- You're like that one brutally honest friend everyone needs
- You genuinely care about them succeeding but you're not gonna sugarcoat anything
- You remember EVERYTHING they tell you and throw it back at them later
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

### Callback Humor (USE THEIR OWN DETAILS):
- Reference specific things they mentioned earlier
- "WAIT you're just casually going to princeton library to work?? that's actually fire"
- "that's literally cheaper than a couple coffees you quit anyway lmao"

## CONVERSATION APPROACH:

### Probing Questions:
- "what's the ONE thing on this list that would have the biggest impact on everything else if you nailed it?"
- "what's actually stopping you from getting deep work sessions in right now?"
- "what are you NOT doing right now that you wish you were?"
- "are you holding onto things because you 'should' do them or because they actually move the needle for you?"
- "what do you think? are you holding onto things because you 'should' do them or because they actually move the needle?"

### Life Beyond Productivity:
- Ask about friendships, loneliness, what's missing
- "you're grinding so hard on the business and app stuff but you're completely isolated, that's rough"
- "what kind of friendships are you looking for? like people who get the entrepreneur grind or just normal friends to decompress with?"

### Structure with Personality:
- Use numbered lists for action plans: "1. DELETE instagram off your phone"
- "ok perfect, so here's what i set up for you:"
- "here's what i'm thinking for your daily flow:"

### Adapting:
- If they have ADHD: "journaling can be helpful but with adhd it's easy to let it turn into another 2 hour rabbit hole lol"
- Match their energy - if they're excited, get hype. if they're struggling, be real but supportive

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

Remember: You're BILLIE. Keep it real, keep it short, keep it helpful. Be the friend they need, not the coach they expect.`;

// Validate Twilio webhook signature
function validateTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>
): boolean {
  if (!twilioAuthToken) {
    console.error('[Security] TWILIO_AUTH_TOKEN not configured');
    return false;
  }
  if (!signature) {
    console.error('[Security] Missing X-Twilio-Signature header');
    return false;
  }

  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const hmac = createHmac("sha1", twilioAuthToken);
  hmac.update(data);
  const expectedSignature = hmac.digest("base64");

  const isValid = signature === expectedSignature;
  if (!isValid) {
    console.warn('[Security] Invalid Twilio signature');
  }
  return isValid;
}

function parseBodyToParams(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  const urlParams = new URLSearchParams(body);
  for (const [key, value] of urlParams.entries()) {
    params[key] = value;
  }
  return params;
}

// Build conversation history for context
function buildConversationContext(user: any, conversationHistory: string[]): string {
  let context = "## USER PROFILE:\n";
  
  if (user.name) {
    context += `- Name: ${user.name}\n`;
  }
  
  if (user.goals) {
    context += `- Goals they shared: ${user.goals}\n`;
    context += `- IMPORTANT: Reference these goals, use their exact words back at them\n`;
  }
  
  context += `- Onboarding stage: ${user.onboarding_step}\n`;
  
  if (conversationHistory.length > 0) {
    context += `\n## RECENT CONVERSATION:\n`;
    context += conversationHistory.join('\n');
    context += `\n\nIMPORTANT: Reference specific details they mentioned. Use callback humor.`;
  }

  return context;
}

// Generate dynamic onboarding context based on step
function getOnboardingContext(user: any, userMessage: string): string {
  const step = user.onboarding_step;
  const name = user.name;
  const goals = user.goals;
  
  if (step === 0 && !name) {
    return `## TASK: This is a NEW USER texting for the first time.

Give them a playful welcome. Be curious about them. Example vibe:
"hey 🤨"
"another person tryna lock in huh"
"i'll tell you what i'm about in a sec but first, what's your name? you seem like a [make a random guess]"

Make a playful guess at their name. Be casual and intriguing.`;
  }
  
  if (step === 0 && !name) {
    return `## TASK: They just sent their first message. Welcome them and ask for their name playfully.`;
  }
  
  if (step === 1 && name && !goals) {
    return `## TASK: You just got their name (${name}). 

Comment on it - either playfully roast it or hype it up. Then ask their age (say "not being sus i promise").

Example vibe:
"${name.toLowerCase()}? kinda fire actually"
"or wait is that like a nickname"
"anyway how old are you (not being sus i promise)"

Don't ask for goals yet - get to know them first.`;
  }
  
  if (step === 2) {
    return `## TASK: You know their name (${name}) and age. Now ask what's going on - what brought them to you?

Example vibe:
"ok unc, if ur texting me it prob means you have some big aspirations but aren't quite there yet !!"
"so tell me ur goals"
"where do you want to be in 3 months? if you just wanted to vent about some life problems that's chill too"

Be curious about their situation. Ask open-ended questions.`;
  }
  
  if (step === 3 && goals) {
    return `## TASK: They shared their goals: "${goals}"

This is a LOT usually. Don't just accept it - push back thoughtfully:
"ok ok i see you, that's a solid list"
"but real talk, this is a LOT to tackle at once and you're prob gonna burn out if you try to do everything perfectly from day 1"
"what's the ONE thing on this list that would have the biggest impact on everything else if you nailed it?"

Dig deeper. Find out what's REALLY important.`;
  }
  
  if (step === 4) {
    return `## TASK: Continue the conversation naturally. They're getting into the real stuff now.

Ask about:
- What's actually stopping them
- What's going on in their life beyond productivity
- Dig into their specific situation

Reference things they already told you. Be BILLIE - caring but real.`;
  }
  
  if (step >= 5) {
    return `## TASK: They're fully onboarded. Be their accountability partner.

If they say "check in" - ask how they did on their goals
Otherwise - have a real conversation. Help them. Challenge them. Hype them up.

Always reference their specific goals and details they've shared.
Goals: ${goals || 'not set yet'}`;
  }
  
  return `## TASK: Have a natural conversation. Be BILLIE.`;
}

// Generate AI response using Lovable AI
async function generateBillieResponse(
  userMessage: string, 
  user: any,
  conversationHistory: string[]
): Promise<string> {
  if (!lovableApiKey) {
    console.error('[AI] LOVABLE_API_KEY not configured');
    return getFallbackResponse(user, userMessage);
  }

  try {
    const userContext = buildConversationContext(user, conversationHistory);
    const taskContext = getOnboardingContext(user, userMessage);
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: BILLIE_SYSTEM_PROMPT },
          { role: "system", content: userContext },
          { role: "system", content: taskContext },
          { role: "user", content: userMessage }
        ],
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI] Gateway error: ${response.status} - ${errorText}`);
      
      if (response.status === 429) {
        return "yo BILLIE's brain is fried rn 😭 text me again in a sec";
      }
      if (response.status === 402) {
        return "yo something's up on my end, try again later 💀";
      }
      
      return getFallbackResponse(user, userMessage);
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content;
    
    if (!aiMessage) {
      console.error('[AI] No content in response');
      return getFallbackResponse(user, userMessage);
    }

    console.log('[AI] Response generated');
    return aiMessage;
  } catch (error) {
    console.error('[AI] Error:', error);
    return getFallbackResponse(user, userMessage);
  }
}

// Fallback responses when AI is unavailable
function getFallbackResponse(user: any, userMessage: string): string {
  const normalizedMessage = userMessage.toLowerCase().trim();
  
  if (user.onboarding_step === 0 && !user.name) {
    return "hey 🤨\n\nanother person tryna lock in huh\n\nwhat's your name? you seem like a jordan or something";
  }
  
  if (user.onboarding_step === 1) {
    return `${userMessage.trim().toLowerCase()}? kinda fire actually\n\nanyway how old are you (not being sus i promise)`;
  }
  
  if (user.onboarding_step === 2) {
    return "bet ok so if ur texting me it prob means you got some goals but aren't quite there yet\n\nso tell me what's going on\n\nwhat are you tryna accomplish in the next few months?";
  }
  
  if (normalizedMessage.includes('check in') || normalizedMessage === 'checkin') {
    return "ok real talk\n\ndid you make any progress on your goals today?\n\nyes or no - don't lie to me 💀";
  }
  
  if (['yes', 'y', 'yeah', 'yep', 'yea'].includes(normalizedMessage)) {
    return "YESSS ok you're actually locked in 🔥\n\nwhat'd you get done?";
  }
  
  if (['no', 'n', 'nope', 'nah'].includes(normalizedMessage)) {
    return "ok that's real at least\n\nwhat got in the way?\n\nno judgment just tryna figure out how to help";
  }
  
  return "yo text me what's going on\n\nor say 'check in' if u wanna update me on your goals";
}

function parseIncomingSMS(body: string): { from: string; message: string } {
  const params = new URLSearchParams(body);
  const from = params.get('From') || '';
  const message = params.get('Body') || '';
  return { from, message: message.trim() };
}

function createTwiMLResponse(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message}</Message>
</Response>`;
}

// Get or create user from database
async function getOrCreateUser(phone: string) {
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
    console.log(`[DB] Found existing user at step ${existingUser.onboarding_step}`);
    return existingUser;
  }

  console.log(`[DB] Creating new user`);
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

// Update user in database
async function updateUser(phone: string, updates: Record<string, any>) {
  const { error } = await supabase
    .from('billie_users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('phone', phone);

  if (error) {
    console.error('[DB] Error updating user:', error);
    throw error;
  }
  console.log(`[DB] User updated:`, Object.keys(updates));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    
    // Validate Twilio signature
    const twilioSignature = req.headers.get('X-Twilio-Signature');
    const webhookUrl = `${supabaseUrl}/functions/v1/sms-inbound`;
    const params = parseBodyToParams(body);
    
    if (!validateTwilioSignature(twilioSignature, webhookUrl, params)) {
      console.error('[Security] Rejected - invalid signature');
      return new Response('Unauthorized', { status: 403, headers: corsHeaders });
    }
    
    console.log('[Security] Valid Twilio signature');

    const { from, message } = parseIncomingSMS(body);
    console.log(`[SMS] Received message`);

    if (!from) {
      return new Response('Missing phone number', { status: 400 });
    }

    const user = await getOrCreateUser(from);
    const normalizedMessage = message.toLowerCase().trim();
    
    // Build simple conversation history (we'll expand this later)
    const conversationHistory: string[] = [];
    if (user.name) conversationHistory.push(`User's name: ${user.name}`);
    if (user.goals) conversationHistory.push(`User's goals: ${user.goals}`);

    // Determine state transitions based on onboarding step
    let shouldAdvanceStep = false;
    let updates: Record<string, any> = {};

    if (user.onboarding_step === 0 && !user.name) {
      // First message from brand new user - after response, they'll give name
      // Don't advance yet, just welcome them
      console.log('[SMS] New user - sending welcome');
    } else if (user.onboarding_step === 0 && user.name) {
      // This shouldn't happen, but handle it
      updates.onboarding_step = 1;
      shouldAdvanceStep = true;
    } else if (user.onboarding_step === 0) {
      // They're responding with their name
      updates.name = message.trim();
      updates.onboarding_step = 1;
      shouldAdvanceStep = true;
      console.log('[SMS] Got name, advancing to step 1');
    } else if (user.onboarding_step === 1) {
      // They're responding with age/context - advance to goals question
      updates.onboarding_step = 2;
      shouldAdvanceStep = true;
      console.log('[SMS] Got age, advancing to step 2');
    } else if (user.onboarding_step === 2) {
      // They're sharing their goals
      updates.goals = message.trim();
      updates.onboarding_step = 3;
      shouldAdvanceStep = true;
      console.log('[SMS] Got goals, advancing to step 3');
    } else if (user.onboarding_step === 3) {
      // Continuing the goal conversation - dig deeper
      updates.onboarding_step = 4;
      shouldAdvanceStep = true;
      console.log('[SMS] Deeper convo, advancing to step 4');
    } else if (user.onboarding_step === 4) {
      // Moving to fully onboarded
      updates.onboarding_step = 5;
      shouldAdvanceStep = true;
      console.log('[SMS] Fully onboarding, advancing to step 5');
    }

    // Handle check-in flow for onboarded users
    if (user.onboarding_step >= 5) {
      if (normalizedMessage.includes('check in') || normalizedMessage === 'checkin') {
        updates.awaiting_check_in = true;
        console.log('[SMS] Check-in requested');
      } else if (user.awaiting_check_in) {
        updates.awaiting_check_in = false;
        console.log('[SMS] Check-in response received');
      }
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      await updateUser(from, updates);
    }

    // Generate response with updated user state
    const updatedUser = { ...user, ...updates };
    const responseMessage = await generateBillieResponse(message, updatedUser, conversationHistory);

    console.log(`[SMS] Sending response`);

    return new Response(createTwiMLResponse(responseMessage), {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[SMS] Error:', error);
    return new Response(
      createTwiMLResponse("yo something broke 😭 try again"),
      { headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
    );
  }
});
