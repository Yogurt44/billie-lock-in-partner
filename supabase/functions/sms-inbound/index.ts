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
  goals?: string;
  onboardingStep: 0 | 1 | 2;
  awaitingCheckIn: boolean;
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
  welcome: "aight unc, what should I call u 😭",
  afterName: (name: string) => `bet. now drop your goals for the next 3 months. list as many as u want. be delulu but realistic.`,
  afterGoals: (goals: string) => `say less. ur winter lock-in goals are: ${goals} 🔒\ntext 'check in' whenever u want accountability.`,
  checkInPrompt: "did u get closer to ANY of your goals today???\nYES or NO — don't lie.",
  checkInYes: "ok slay 🔥 ur actually locked in.",
  checkInNo: "bro be fr 😭 it's fine, we lock in tomorrow.",
  alreadyOnboarded: (goals: string) => `ur winter lock-in goals are: ${goals} 🔒\ntext 'check in' whenever u want accountability.`,
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
      // New user - start onboarding at step 0
      console.log(`[SMS Inbound] New user: ${from}`);
      userStates[from] = {
        phone: from,
        onboardingStep: 0,
        awaitingCheckIn: false,
      };
      responseMessage = RESPONSES.welcome;
    } else {
      const user = userStates[from];
      console.log(`[SMS Inbound] Existing user state:`, user);

      // Check if awaiting check-in response first
      if (user.awaitingCheckIn) {
        if (normalizedMessage === 'yes' || normalizedMessage === 'y' || normalizedMessage === 'yeah' || normalizedMessage === 'yep' || normalizedMessage === 'yea') {
          user.awaitingCheckIn = false;
          responseMessage = RESPONSES.checkInYes;
          console.log(`[SMS Inbound] Check-in: YES`);
        } else if (normalizedMessage === 'no' || normalizedMessage === 'n' || normalizedMessage === 'nope' || normalizedMessage === 'nah') {
          user.awaitingCheckIn = false;
          responseMessage = RESPONSES.checkInNo;
          console.log(`[SMS Inbound] Check-in: NO`);
        } else {
          responseMessage = "yo just say YES or NO 💀";
        }
      } else {
        // Handle based on onboarding step
        switch (user.onboardingStep) {
          case 0:
            // User is providing their name
            user.name = message.trim();
            user.onboardingStep = 1;
            responseMessage = RESPONSES.afterName(user.name);
            console.log(`[SMS Inbound] Name set: ${user.name}`);
            break;

          case 1:
            // User is providing their goals
            user.goals = message.trim();
            user.onboardingStep = 2;
            responseMessage = RESPONSES.afterGoals(user.goals);
            console.log(`[SMS Inbound] Goals set: ${user.goals}`);
            break;

          case 2:
            // User is onboarded - check for "check in"
            if (normalizedMessage.includes('check in') || normalizedMessage === 'checkin') {
              user.awaitingCheckIn = true;
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
