# BILLIE 🔒

**Your accountaBILLIEty partner — by text.**

BILLIE is an SMS-based accountability bot that helps people lock in on their goals. No app downloads, no accounts, no dashboards — just text a number and BILLIE holds you accountable with blunt, Gen Z energy.

---

## 🎯 MVP Use Case

**Target User:** People who are done making excuses and need someone (or something) to hold them accountable — especially for Winter 2025 goals.

**Core Flow:**
1. User texts the BILLIE phone number
2. BILLIE asks for their name
3. BILLIE asks what goal they want to lock in on
4. BILLIE sends daily check-ins asking if they did the thing
5. BILLIE responds with encouragement or tough love based on their answer

**Key Differentiator:** No friction. No app. No signup. Just text and get held accountable.

---

## 🏗️ Current State

### ✅ What's Built

**Landing Page (`/`)**
- Hero section with CTA to text BILLIE
- "How It Works" section explaining the 3-step flow
- Phone mockup showing sample conversation
- Footer with secondary CTA
- Dark/light theme toggle
- Mobile-responsive design
- Winter minimal aesthetic (white, black, blue palette)

**Backend (Edge Function)**
- `sms-inbound` function ready to receive Twilio webhooks
- Hardcoded response flow for onboarding:
  - Welcome → Ask name → Ask goal → Confirm
- Daily check-in responses (yes/no handling)
- In-memory user state (no database)
- Stubbed OpenAI function for future AI responses

### ❌ What's NOT Built Yet

1. **Real Phone Number** - Currently using placeholder `+15555555555`
2. **Twilio Integration** - Need to configure Twilio webhook to point to the edge function
3. **OpenAI Integration** - Function is stubbed, needs API key and prompt engineering
4. **Scheduled Check-ins** - No cron job to send daily "did you lock in?" messages
5. **Persistence** - User state is in-memory only (resets on function cold start)

---

## 🔧 Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend:** Supabase Edge Functions (Deno)
- **SMS:** Twilio (to be connected)
- **AI:** OpenAI or Lovable AI (to be integrated)

---

## 🚀 What's Next (In Order)

### Phase 1: Connect Twilio
1. Create a Twilio account and buy a phone number
2. Set up the webhook URL: `https://vqfcnpmvzvukdfoitzue.supabase.co/functions/v1/sms-inbound`
3. Update the phone number in `HeroSection.tsx` and `FooterSection.tsx`
4. Test the full SMS flow

### Phase 2: Add AI Responses
1. Enable Lovable AI (or add OpenAI API key)
2. Update `sms-inbound` edge function to use AI for dynamic, personalized responses
3. Craft system prompt to maintain BILLIE's personality:
   - Blunt and funny
   - Gen Z slang
   - Super short messages
   - No long paragraphs

### Phase 3: Scheduled Check-ins
1. Add a database table to persist user state (phone, name, goal, last check-in)
2. Create a cron job edge function to send daily check-in messages
3. Handle timezone considerations

### Phase 4: Polish
1. Add more personality variations to responses
2. Handle edge cases (user says random things, re-onboarding, etc.)
3. Analytics on engagement

---

## 📁 Project Structure

```
src/
├── components/
│   ├── HeroSection.tsx      # Main landing hero with CTA
│   ├── HowItWorksSection.tsx # 3-step explainer
│   ├── PhoneMockup.tsx      # Visual phone conversation preview
│   ├── FooterSection.tsx    # Footer CTA
│   ├── ThemeToggle.tsx      # Dark/light mode toggle
│   └── ui/                  # shadcn components
├── pages/
│   └── Index.tsx            # Main landing page
└── index.css                # Design system tokens

supabase/
└── functions/
    └── sms-inbound/
        └── index.ts         # Twilio webhook handler
```

---

## 🎨 Design Decisions

- **Minimal Winter Aesthetic:** White, black, and ice blue. Clean and simple.
- **No Database (MVP):** Keeps it simple. State is ephemeral.
- **No User Accounts:** Anonymous accountability. Just text and go.
- **Gen Z Tone:** BILLIE talks like a friend, not a corporate bot.

---

## 💡 Personality Guidelines

BILLIE's messages should be:
- **Short** — No paragraphs. 1-2 sentences max.
- **Blunt** — Direct, no sugarcoating.
- **Funny** — Playful roasts, memes energy.
- **Gen Z** — Use slang naturally (not forced).
- **Supportive** — Tough love, but still love.

Examples:
- "yooo [name]! did u actually do the thing today? no cap"
- "lets gooo ur actually locked in fr fr 🔥"
- "nah thats not giving... tmrw we go crazy tho"

---

## 🤔 Should You Move to Cursor?

**Stay in Lovable for:**
- UI/UX changes
- Landing page iterations
- Design system updates
- Quick prototyping

**Move to Cursor for:**
- Complex OpenAI prompt engineering
- Twilio webhook debugging
- Cron job setup
- Database schema design
- Production deployment configs

**Recommended:** Finish the Twilio connection in Lovable (just need to update phone numbers), then move to Cursor for AI integration and scheduled messaging.

---

## 📞 Edge Function URL

```
https://vqfcnpmvzvukdfoitzue.supabase.co/functions/v1/sms-inbound
```

Point your Twilio webhook here (HTTP POST, `application/x-www-form-urlencoded`).

---

Built for people who are done making excuses. Let's lock in. 🔒
