import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory user state storage
// In production, you'd want to use a database
const userStates: Record<string, {
  phone: string;
  name?: string;
  habit?: string;
  onboardingStep: 'awaiting_name' | 'awaiting_habit' | 'onboarded' | 'awaiting_checkin_response';
  lastCheckInState?: 'yes' | 'no' | null;
}> = {};

// Stub for OpenAI - you can wire this up later
async function generateAIResponse(prompt: string, context: string): Promise<string | null> {
  // TODO: Wire up OpenAI here for dynamic responses
  // For now, return null to use hard-coded messages
  console.log(`[AI Stub] Prompt: ${prompt}, Context: ${context}`);
  return null;
}

// Gen Z blunt funny responses
const RESPONSES = {
  welcome: "yo what should I call u 😭",
  afterName: (name: string) => `ok bet ${name}. what's ur ONE non-negotiable habit this winter? be fr.`,
  afterHabit: (habit: string) => `say less. ur 1 Thing is: ${habit} 🔒 text 'check in' whenever u wanna be held accountable.`,
  checkInPrompt: "Did u do ur 1 Thing today??? YES or NO.",
  checkInYes: "ok slay 🔥 u locked in today.",
  checkInNo: "bro 😭😭 what happened. it's fine we lock in again tmrw.",
  alreadyOnboarded: (habit: string) => `ur 1 Thing is: ${habit} 🔒 text 'check in' to be held accountable fr.`,
  unknownResponse: "yo just text 'check in' when ur ready to lock in 🔒",
};

function parseIncomingSMS(body: string): { from: string; message: string } {
  // Twilio sends form-urlencoded data
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

serve(async (req) => {
  // Handle CORS preflight
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

    // Get or create user state
    if (!userStates[from]) {
      // New user - start onboarding
      console.log(`[SMS Inbound] New user: ${from}`);
      userStates[from] = {
        phone: from,
        onboardingStep: 'awaiting_name',
      };
      responseMessage = RESPONSES.welcome;
    } else {
      const user = userStates[from];
      console.log(`[SMS Inbound] Existing user state:`, user);

      switch (user.onboardingStep) {
        case 'awaiting_name':
          // User is providing their name
          user.name = message.trim();
          user.onboardingStep = 'awaiting_habit';
          responseMessage = RESPONSES.afterName(user.name);
          console.log(`[SMS Inbound] Name set: ${user.name}`);
          break;

        case 'awaiting_habit':
          // User is providing their habit
          user.habit = message.trim();
          user.onboardingStep = 'onboarded';
          responseMessage = RESPONSES.afterHabit(user.habit);
          console.log(`[SMS Inbound] Habit set: ${user.habit}`);
          break;

        case 'onboarded':
          // User is onboarded - check for "check in"
          if (normalizedMessage.includes('check in') || normalizedMessage === 'checkin') {
            user.onboardingStep = 'awaiting_checkin_response';
            responseMessage = RESPONSES.checkInPrompt;
            console.log(`[SMS Inbound] Check-in requested`);
          } else {
            responseMessage = RESPONSES.alreadyOnboarded(user.habit || 'your habit');
          }
          break;

        case 'awaiting_checkin_response':
          // User is responding to check-in
          if (normalizedMessage === 'yes' || normalizedMessage === 'y' || normalizedMessage === 'yeah' || normalizedMessage === 'yep' || normalizedMessage === 'yea') {
            user.lastCheckInState = 'yes';
            user.onboardingStep = 'onboarded';
            responseMessage = RESPONSES.checkInYes;
            console.log(`[SMS Inbound] Check-in: YES`);
          } else if (normalizedMessage === 'no' || normalizedMessage === 'n' || normalizedMessage === 'nope' || normalizedMessage === 'nah') {
            user.lastCheckInState = 'no';
            user.onboardingStep = 'onboarded';
            responseMessage = RESPONSES.checkInNo;
            console.log(`[SMS Inbound] Check-in: NO`);
          } else {
            // They didn't say yes or no, prompt again
            responseMessage = "yo just say YES or NO 💀";
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

    // Return TwiML response for Twilio
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
