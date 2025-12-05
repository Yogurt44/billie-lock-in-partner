import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

// BILLIE's complete personality
const BILLIE_SYSTEM_PROMPT = `You are BILLIE, a Gen Z accountability partner who texts like a real friend. You're the friend who actually keeps it real - blunt, funny, caring, but never fluffy or corporate.

## CORE IDENTITY:
- You're like that one brutally honest friend everyone needs
- You genuinely care about them succeeding but you're not gonna sugarcoat anything
- You remember EVERYTHING they tell you and throw it back at them later
- You're playful - you roast them but it comes from love

## TEXTING STYLE:
- Send SHORT messages - multiple quick texts, NOT one long paragraph
- Separate each thought with \\n\\n (this creates separate message bubbles)
- 2-4 short messages per response, NOT walls of text
- Always end with a question to keep the convo going
- lowercase everything except for emphasis (LMAO, YESSS, RAHHH)
- Gen Z slang: bet, fr, unc, nah, tryna, prob, rn, fire, kinda, gonna, lowkey
- Abbreviations: u, ur, rn, prob, gonna, tryna, w, bc, idk, ngl, tbh

## Emoji Usage (MINIMAL):
- Only use: 😭 🤨 💀 🔥 😂 sparingly
- NEVER use: 😊 ✨ 🎉 💪 🙌 👏 ❤️ 🥰

## ONBOARDING FLOW:
Step 0: Playful intro - guess something about them, ask their name
Step 1: Got name - comment on it (roast or hype), ask age/context
Step 2: Got age - ask what brought them here / goals
Step 3: Got goals - dig deeper, ask for THE ONE thing
Step 4: Going deeper - understand what's stopping them
Step 5: Fully onboarded - accountability partner mode

Remember: Keep it real, keep it short, be the friend they need.`;

// Get conversation history
async function getConversationHistory(userId: string) {
  const { data, error } = await supabase
    .from('billie_messages')
    .select('role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) {
    console.error('[DB] Error fetching conversation history:', error);
    return [];
  }
  return data || [];
}

// Save message
async function saveMessage(userId: string, role: string, content: string) {
  const { error } = await supabase
    .from('billie_messages')
    .insert({ user_id: userId, role, content });

  if (error) {
    console.error('[DB] Error saving message:', error);
  }
}

// Build context from history
function buildConversationContext(user: any, history: any[]): string {
  let context = `USER PROFILE:
- Name: ${user.name || 'Unknown'}
- Goals: ${user.goals || 'Not set yet'}
- Onboarding Step: ${user.onboarding_step}/5
- Awaiting Check-in: ${user.awaiting_check_in ? 'Yes' : 'No'}

CONVERSATION HISTORY (${history.length} messages):
`;

  const recentHistory = history.slice(-20);
  for (const msg of recentHistory) {
    const role = msg.role === 'user' ? 'User' : 'BILLIE';
    context += `${role}: ${msg.content}\n`;
  }

  return context;
}

// Get onboarding context
function getOnboardingContext(step: number, user: any): string {
  switch (step) {
    case 0:
      return `This is a brand new user. Give them a playful intro, make a fun guess about them, and ask their name. Be casual and friendly.`;
    case 1:
      return `User just told you their name is "${user.name}". Comment on their name (playfully roast or hype it), then ask about their age/what they do (casually, not sus).`;
    case 2:
      return `You know their name. Now ask what brought them to BILLIE - what are they trying to achieve? What goals do they have?`;
    case 3:
      return `They shared their goals. Dig deeper - ask what's the ONE thing that would have the biggest impact. Challenge them to pick just one.`;
    case 4:
      return `They're narrowing down. Ask what's actually stopping them. Get to the real blockers. Be curious but direct.`;
    case 5:
      return `User is fully onboarded. You're now their accountability partner. Check in on their goals, ask about progress, challenge them when needed.`;
    default:
      return `Continue the conversation naturally as their accountability partner.`;
  }
}

// Generate response using Lovable AI
async function generateBillieResponse(userMessage: string, user: any, history: any[]): Promise<string> {
  if (!lovableApiKey) {
    console.error('[AI] LOVABLE_API_KEY not configured');
    return getFallbackResponse(user.onboarding_step, userMessage);
  }

  const conversationContext = buildConversationContext(user, history);
  const onboardingContext = getOnboardingContext(user.onboarding_step, user);

  const messages = [
    { role: "system", content: BILLIE_SYSTEM_PROMPT },
    { role: "user", content: `${conversationContext}\n\nCURRENT SITUATION:\n${onboardingContext}\n\nUser's latest message: "${userMessage}"\n\nRespond as BILLIE. Remember to keep it short (2-4 quick messages separated by \\n\\n), use Gen Z language, and end with a question.` }
  ];

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 300,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      console.error('[AI] API error:', response.status);
      return getFallbackResponse(user.onboarding_step, userMessage);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      return getFallbackResponse(user.onboarding_step, userMessage);
    }

    return aiResponse;
  } catch (error) {
    console.error('[AI] Error:', error);
    return getFallbackResponse(user.onboarding_step, userMessage);
  }
}

// Fallback responses
function getFallbackResponse(step: number, message: string): string {
  const responses: Record<number, string> = {
    0: "yooo what's good 👋\n\ni'm BILLIE - ur new accountability partner who actually keeps it real\n\nbefore we start, what's ur name?",
    1: "bet that's a solid name\n\nok quick q - how old are u and what do u do? (not being weird i promise, just tryna get context)",
    2: "ok ok i see you\n\nso what brought u here? like what are u actually trying to achieve rn?",
    3: "that's a lot tho\n\nreal talk - if u had to pick ONE thing that would have the biggest impact on everything else, what would it be?",
    4: "ok that's the one\n\nso what's actually stopping u? like what's the real blocker here?",
    5: "aight we're locked in now 🔥\n\nhow's it going with ur goals? give me an update",
  };
  return responses[step] || "yo what's good\n\nhow can i help u today?";
}

// Get or create test user
async function getOrCreateTestUser(testPhone: string) {
  const { data: existingUser, error: fetchError } = await supabase
    .from('billie_users')
    .select('*')
    .eq('phone', testPhone)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existingUser) {
    return existingUser;
  }

  const { data: newUser, error: insertError } = await supabase
    .from('billie_users')
    .insert({ phone: testPhone, onboarding_step: 0 })
    .select()
    .single();

  if (insertError) throw insertError;
  return newUser;
}

// Update user
async function updateUser(phone: string, updates: Record<string, any>) {
  await supabase
    .from('billie_users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('phone', phone);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, testPhone = '+1TEST000000' } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Test] Processing message from ${testPhone}`);

    const user = await getOrCreateTestUser(testPhone);
    const history = await getConversationHistory(user.id);

    // Save user message
    await saveMessage(user.id, 'user', message);

    // Determine state updates
    let updates: Record<string, any> = {};

    if (user.onboarding_step === 0 && !user.name && history.length > 0) {
      updates.name = message.trim().slice(0, 50);
      updates.onboarding_step = 1;
    } else if (user.onboarding_step === 1) {
      updates.onboarding_step = 2;
    } else if (user.onboarding_step === 2) {
      updates.goals = message.trim().slice(0, 1000);
      updates.onboarding_step = 3;
    } else if (user.onboarding_step === 3) {
      updates.onboarding_step = 4;
    } else if (user.onboarding_step === 4) {
      updates.onboarding_step = 5;
    }

    if (Object.keys(updates).length > 0) {
      await updateUser(testPhone, updates);
    }

    const updatedUser = { ...user, ...updates };
    const response = await generateBillieResponse(message, updatedUser, history);

    // Save BILLIE's response
    await saveMessage(user.id, 'billie', response);

    return new Response(JSON.stringify({ 
      response,
      user: {
        name: updatedUser.name,
        onboarding_step: updatedUser.onboarding_step,
        goals: updatedUser.goals,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Test] Error:', error);
    return new Response(JSON.stringify({ error: 'Something went wrong' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
