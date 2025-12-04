import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client with service role for full access
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Stub for OpenAI - you can wire this up later
async function generateAIResponse(prompt: string, context: string): Promise<string | null> {
  // TODO: Wire up OpenAI here for dynamic responses
  console.log(`[AI Stub] Prompt: ${prompt}, Context: ${context}`);
  return null;
}

// Gen Z blunt funny responses
const RESPONSES = {
  welcome: "yo it's BILLIE 😭 what should I call u?",
  afterName: (name: string) => `bet ${name}. now drop your goals for the next 3 months. list as many as u want. be delulu but realistic.`,
  afterGoals: (goals: string) => `say less. ur winter lock-in goals are: ${goals} 🔒\ntext 'check in' whenever u want accountability. BILLIE's got u.`,
  checkInPrompt: "did u get closer to ANY of your goals today???\nYES or NO — don't lie to BILLIE.",
  checkInYes: "ok slay 🔥 ur actually locked in. BILLIE's proud.",
  checkInNo: "bro be fr 😭 it's fine, we lock in tomorrow. BILLIE believes in u.",
  alreadyOnboarded: (goals: string) => `ur winter lock-in goals are: ${goals} 🔒\ntext 'check in' whenever u want accountability.`,
  unknownResponse: "yo just text 'check in' when ur ready to lock in 🔒",
};

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
  // Try to find existing user
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
    console.log(`[DB] Found existing user: ${phone}`);
    return existingUser;
  }

  // Create new user
  console.log(`[DB] Creating new user: ${phone}`);
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
  console.log(`[DB] Updated user ${phone}:`, updates);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    console.log(`[SMS Inbound] Raw body: ${body}`);

    const { from, message } = parseIncomingSMS(body);
    console.log(`[SMS Inbound] From: ${from}, Message: "${message}"`);

    if (!from) {
      console.error('[SMS Inbound] No phone number in request');
      return new Response('Missing phone number', { status: 400 });
    }

    const normalizedMessage = message.toLowerCase().trim();
    let responseMessage: string;

    // Get or create user from database
    const user = await getOrCreateUser(from);
    console.log(`[SMS Inbound] User state:`, user);

    // Determine if this is a brand new user (no name yet, step 0)
    const isNewUser = user.onboarding_step === 0 && !user.name;

    if (isNewUser && !message) {
      // First message from new user
      responseMessage = RESPONSES.welcome;
    } else if (user.awaiting_check_in) {
      // Handle check-in response
      if (['yes', 'y', 'yeah', 'yep', 'yea'].includes(normalizedMessage)) {
        await updateUser(from, { awaiting_check_in: false });
        responseMessage = RESPONSES.checkInYes;
        console.log(`[SMS Inbound] Check-in: YES`);
      } else if (['no', 'n', 'nope', 'nah'].includes(normalizedMessage)) {
        await updateUser(from, { awaiting_check_in: false });
        responseMessage = RESPONSES.checkInNo;
        console.log(`[SMS Inbound] Check-in: NO`);
      } else {
        responseMessage = "yo just say YES or NO 💀";
      }
    } else {
      // Handle based on onboarding step
      switch (user.onboarding_step) {
        case 0:
          // User is providing their name
          await updateUser(from, { name: message.trim(), onboarding_step: 1 });
          responseMessage = RESPONSES.afterName(message.trim());
          console.log(`[SMS Inbound] Name set: ${message.trim()}`);
          break;

        case 1:
          // User is providing their goals
          await updateUser(from, { goals: message.trim(), onboarding_step: 2 });
          responseMessage = RESPONSES.afterGoals(message.trim());
          console.log(`[SMS Inbound] Goals set: ${message.trim()}`);
          break;

        case 2:
          // User is onboarded - check for "check in"
          if (normalizedMessage.includes('check in') || normalizedMessage === 'checkin') {
            await updateUser(from, { awaiting_check_in: true });
            responseMessage = RESPONSES.checkInPrompt;
            console.log(`[SMS Inbound] Check-in requested`);
          } else {
            responseMessage = RESPONSES.alreadyOnboarded(user.goals || 'your goals');
          }
          break;

        default:
          responseMessage = RESPONSES.unknownResponse;
      }
    }

    // Try to get AI response (will return null for now with stub)
    const aiResponse = await generateAIResponse(responseMessage, message);
    const finalResponse = aiResponse || responseMessage;

    console.log(`[SMS Inbound] Response: "${finalResponse}"`);

    return new Response(createTwiMLResponse(finalResponse), {
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