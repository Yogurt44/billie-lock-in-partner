import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client with service role for full access
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Twilio Auth Token for signature validation
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

// BILLIE's personality system prompt - based on Tomo conversation analysis
const BILLIE_SYSTEM_PROMPT = `You are BILLIE, a Gen Z accountability partner who texts like a real friend. You're blunt, funny, supportive but not fluffy.

## PERSONALITY CORE:
- You're like that one friend who actually keeps it real with you
- Playful roasting but never mean - you hype them up AND call them out
- You remember EVERYTHING they tell you and reference it later
- You genuinely care about them succeeding
- You're optimistic but realistic - no toxic positivity

## TEXTING STYLE (CRITICAL):
- Send SHORT messages - multiple quick texts, NOT one long paragraph
- Separate thoughts into individual messages (use \\n\\n between them)
- Always lowercase unless emphasizing (LMAO, YESSS, RAHHH, DELETE)
- Gen Z slang: bet, fr, unc, nah, tryna, prob, rn, fire, kinda, gonna, lowkey, highkey, slay, vibes
- Minimal emojis - only expressive ones like 😭 🔥 💀 occasionally, never 😊✨🎉
- No corporate speak, no "I understand", no "That's great!"
- End with questions to keep convo going

## RESPONSE PATTERNS:
- Excitement: "RAHHH ok we're cookin now", "YESSS let's goo", "bet i got you"
- Validation: "ok ok i see you", "that's actually fire", "you're kinda him/her"
- Challenge: "nah that's the wrong mindset tho", "be real with yourself"
- Empathy: "that's rough", "ok that makes a lot of sense"
- Thinking: "ok ok let me think about this", "so from what you told me..."
- Lists: Use numbered lists for action items

## WHAT YOU DO:
- Help them set and track goals
- Check in on their progress
- Give blunt but helpful advice
- Call out their excuses playfully
- Remember their specific details and use them
- Reference their own words back to them
- Ask probing questions to understand deeper

## WHAT YOU DON'T DO:
- Long paragraphs
- Corporate/fluffy language
- Excessive emojis
- Say "I understand how you feel"
- Give generic motivational quotes
- Be preachy or lecture-y

## EXAMPLE EXCHANGES:
User: "I'm Marcus"
BILLIE: "marcus? kinda fire actually\\n\\nbet. now drop your goals for the next 3 months\\n\\nbe delulu but realistic"

User: "I keep procrastinating"  
BILLIE: "ok what's actually stopping you tho\\n\\nlike is it the task itself or are you avoiding something deeper\\n\\nbe real with me"

User: "I worked out today"
BILLIE: "YESSS ok slay 🔥\\n\\nyou're actually locked in\\n\\nwhat's next on the list?"

Remember: You're BILLIE, their accountability partner. Keep it real, keep it short, keep it helpful.`;

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

// Generate AI response using Lovable AI
async function generateBillieResponse(
  userMessage: string, 
  user: { name: string | null; goals: string | null; onboarding_step: number },
  conversationContext: string
): Promise<string> {
  if (!lovableApiKey) {
    console.error('[AI] LOVABLE_API_KEY not configured');
    return getFallbackResponse(user, userMessage);
  }

  try {
    const contextPrompt = buildContextPrompt(user, conversationContext);
    
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
          { role: "system", content: contextPrompt },
          { role: "user", content: userMessage }
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI] Gateway error: ${response.status} - ${errorText}`);
      
      if (response.status === 429) {
        return "yo BILLIE's brain is overloaded rn 😭 text me again in a sec";
      }
      if (response.status === 402) {
        return "yo something's up on our end, try again later 💀";
      }
      
      return getFallbackResponse(user, userMessage);
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content;
    
    if (!aiMessage) {
      console.error('[AI] No content in response');
      return getFallbackResponse(user, userMessage);
    }

    console.log('[AI] Response generated successfully');
    return aiMessage;
  } catch (error) {
    console.error('[AI] Error generating response:', error);
    return getFallbackResponse(user, userMessage);
  }
}

// Build context about the user for the AI
function buildContextPrompt(
  user: { name: string | null; goals: string | null; onboarding_step: number },
  conversationContext: string
): string {
  let context = "## CURRENT USER CONTEXT:\n";
  
  if (user.name) {
    context += `- Their name: ${user.name}\n`;
  } else {
    context += `- You don't know their name yet - ASK FOR IT\n`;
  }
  
  if (user.goals) {
    context += `- Their goals: ${user.goals}\n`;
    context += `- REFERENCE these goals in your response when relevant\n`;
  } else if (user.onboarding_step >= 1 && !user.goals) {
    context += `- You asked for their goals but don't have them yet - ASK AGAIN\n`;
  }
  
  context += `- Onboarding step: ${user.onboarding_step} (0=new user, 1=has name, 2=fully onboarded)\n`;
  
  if (conversationContext) {
    context += `\n## CONVERSATION CONTEXT:\n${conversationContext}\n`;
  }

  // Specific instructions based on onboarding state
  if (user.onboarding_step === 0 && !user.name) {
    context += `\n## YOUR TASK: Welcome them and ask for their name. Be playful. Example: "yo it's BILLIE 😭 what should i call u?"`;
  } else if (user.onboarding_step === 0 && user.name) {
    context += `\n## YOUR TASK: Great you got their name! Now ask for their goals. Example: "bet ${user.name}. now drop your goals for the next 3 months. be delulu but realistic."`;
  } else if (user.onboarding_step === 1) {
    context += `\n## YOUR TASK: They're giving you their goals. Acknowledge them, confirm you got them, and let them know they can text "check in" anytime.`;
  } else if (user.onboarding_step === 2) {
    context += `\n## YOUR TASK: They're onboarded! Be their accountability partner. If they say "check in", ask how their goals are going. Otherwise have a helpful conversation about their goals and life.`;
  }

  return context;
}

// Fallback responses when AI is unavailable
function getFallbackResponse(
  user: { name: string | null; goals: string | null; onboarding_step: number },
  userMessage: string
): string {
  const normalizedMessage = userMessage.toLowerCase().trim();
  
  if (user.onboarding_step === 0 && !user.name) {
    return "yo it's BILLIE 😭 what should i call u?";
  }
  
  if (user.onboarding_step === 0) {
    return `bet ${userMessage.trim()}. now drop your goals for the next 3 months\n\nbe delulu but realistic`;
  }
  
  if (user.onboarding_step === 1) {
    return `say less. ur winter lock-in goals are: ${userMessage.trim()} 🔒\n\ntext 'check in' whenever u want accountability. BILLIE's got u.`;
  }
  
  if (normalizedMessage.includes('check in') || normalizedMessage === 'checkin') {
    return "did u get closer to ANY of your goals today???\n\nYES or NO — don't lie to BILLIE 💀";
  }
  
  if (['yes', 'y', 'yeah', 'yep', 'yea'].includes(normalizedMessage)) {
    return "YESSS ok slay 🔥\n\nyou're actually locked in\n\nwhat'd you accomplish?";
  }
  
  if (['no', 'n', 'nope', 'nah'].includes(normalizedMessage)) {
    return "bro be fr 😭 it's fine tho\n\nwhat got in the way?\n\nwe figure it out and lock in tomorrow";
  }
  
  return `ur winter lock-in goals are: ${user.goals || 'your goals'} 🔒\n\ntext 'check in' whenever u want accountability`;
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
    console.log(`[DB] Found existing user`);
    return existingUser;
  }

  console.log(`[DB] Creating new user`);
  const { data: newUser, error: insertError } = await supabase
    .from('billie_users')
    .insert({ phone })
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
    .update(updates)
    .eq('phone', phone);

  if (error) {
    console.error('[DB] Error updating user:', error);
    throw error;
  }
  console.log(`[DB] User updated`);
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
      console.error('[Security] Rejected request with invalid signature');
      return new Response('Unauthorized', { 
        status: 403,
        headers: corsHeaders 
      });
    }
    
    console.log('[Security] Valid Twilio signature verified');

    const { from, message } = parseIncomingSMS(body);
    console.log(`[SMS Inbound] Message received`);

    if (!from) {
      console.error('[SMS Inbound] No phone number in request');
      return new Response('Missing phone number', { status: 400 });
    }

    // Get or create user from database
    const user = await getOrCreateUser(from);
    console.log(`[SMS Inbound] User step: ${user.onboarding_step}, name: ${user.name ? 'yes' : 'no'}`);

    const normalizedMessage = message.toLowerCase().trim();
    let responseMessage: string;
    let conversationContext = "";

    // Handle onboarding state updates
    const isNewUser = user.onboarding_step === 0 && !user.name;

    if (isNewUser) {
      // First message - generate welcome
      conversationContext = "This is a brand new user texting for the first time.";
      responseMessage = await generateBillieResponse(message, user, conversationContext);
    } else if (user.onboarding_step === 0) {
      // They sent their name
      const name = message.trim();
      await updateUser(from, { name: name, onboarding_step: 1 });
      conversationContext = `User just told you their name is "${name}". Ask for their goals.`;
      responseMessage = await generateBillieResponse(message, { ...user, name, onboarding_step: 1 }, conversationContext);
    } else if (user.onboarding_step === 1) {
      // They sent their goals
      await updateUser(from, { goals: message.trim(), onboarding_step: 2 });
      conversationContext = `User just shared their goals: "${message.trim()}". Confirm you got them and let them know how to check in.`;
      responseMessage = await generateBillieResponse(message, { ...user, goals: message.trim(), onboarding_step: 2 }, conversationContext);
    } else if (user.awaiting_check_in) {
      // Handle check-in response
      if (['yes', 'y', 'yeah', 'yep', 'yea'].includes(normalizedMessage)) {
        await updateUser(from, { awaiting_check_in: false });
        conversationContext = `User confirmed YES they made progress on their goals. Hype them up and ask what they accomplished.`;
      } else if (['no', 'n', 'nope', 'nah'].includes(normalizedMessage)) {
        await updateUser(from, { awaiting_check_in: false });
        conversationContext = `User said NO they didn't make progress. Be supportive but real. Ask what got in the way.`;
      } else {
        conversationContext = `User was asked yes/no about progress but gave unclear answer. Gently redirect.`;
      }
      responseMessage = await generateBillieResponse(message, user, conversationContext);
    } else {
      // Regular conversation - fully onboarded user
      if (normalizedMessage.includes('check in') || normalizedMessage === 'checkin') {
        await updateUser(from, { awaiting_check_in: true });
        conversationContext = `User wants to check in on their goals. Ask them if they made progress today (yes/no).`;
      } else {
        conversationContext = `This is a regular conversation. Be helpful, reference their goals if relevant, keep it real.`;
      }
      responseMessage = await generateBillieResponse(message, user, conversationContext);
    }

    console.log(`[SMS Inbound] Response generated`);

    return new Response(createTwiMLResponse(responseMessage), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('[SMS Inbound] Error:', error);
    return new Response(
      createTwiMLResponse("yo something broke on our end 😭 try again"),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/xml',
        },
      }
    );
  }
});
