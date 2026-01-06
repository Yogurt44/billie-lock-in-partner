import { motion } from "framer-motion";

interface Message {
  from: "user" | "bot";
  text: string;
}

interface ConversationProps {
  title: string;
  subtitle: string;
  messages: Message[];
  delay?: number;
}

const ConversationMockup = ({ title, subtitle, messages, delay = 0 }: ConversationProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="flex flex-col"
    >
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      
      {/* Phone frame */}
      <div className="relative bg-midnight rounded-[2.5rem] p-2.5 card-shadow mx-auto max-w-[280px]">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-midnight rounded-b-2xl z-20" />
        
        {/* Screen */}
        <div className="bg-background rounded-[2rem] overflow-hidden">
          {/* Status bar */}
          <div className="h-10 bg-card flex items-center justify-center border-b border-border">
            <span className="text-xs font-medium text-foreground">BILLIE 🔒</span>
          </div>

          {/* Messages */}
          <div className="p-3 space-y-2 min-h-[320px] max-h-[320px] overflow-hidden bg-frost/20">
            {messages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: delay + index * 0.1 }}
                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    msg.from === "user"
                      ? "bg-ice text-accent-foreground rounded-br-sm"
                      : "bg-card text-card-foreground rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Input bar */}
          <div className="h-10 bg-card border-t border-border flex items-center px-3">
            <div className="flex-1 h-7 bg-muted rounded-full px-3 flex items-center">
              <span className="text-xs text-muted-foreground">iMessage</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Conversation 1: First contact / personality showcase
const introConversation: Message[] = [
  { from: "user", text: "hey" },
  { from: "bot", text: "yoo who's this" },
  { from: "bot", text: "wait let me guess... ur name is probably like yogurt44 or something lol" },
  { from: "user", text: "lmaooo its marcus" },
  { from: "bot", text: "MARCUS. ok bet. how old r u marcus" },
  { from: "user", text: "22" },
  { from: "bot", text: "22 and texting a bot for accountability... i respect it honestly. what goals we locking in?" },
];

// Conversation 2: Goal setting
const goalSettingConversation: Message[] = [
  { from: "user", text: "gym 4x a week, read 2 books, stop doom scrolling" },
  { from: "bot", text: "say less. ur goals are locked in:" },
  { from: "bot", text: "1. gym 4x a week\n2. read 2 books\n3. stop doom scrolling" },
  { from: "bot", text: "how often u want me checking in? once, twice, or three times a day?" },
  { from: "user", text: "twice" },
  { from: "bot", text: "bet. morning and evening it is. ur officially locked in 🔒" },
];

// Conversation 3: Check-in roast (missed)
const roastConversation: Message[] = [
  { from: "bot", text: "yo marcus. daily check in time. how we doing on those goals today?" },
  { from: "user", text: "uhhh i skipped the gym" },
  { from: "bot", text: "bro." },
  { from: "bot", text: "u said gym 4x a week. it's wednesday and u at 0. the treadmill misses u fr" },
  { from: "user", text: "i knowww 😭" },
  { from: "bot", text: "tomorrow. no excuses. ur future self is counting on present u to not be a flop" },
];

// Conversation 4: Celebration
const celebrationConversation: Message[] = [
  { from: "bot", text: "check in time bestie. how'd today go?" },
  { from: "user", text: "went to the gym AND read for 30 mins" },
  { from: "bot", text: "YOOO look at u go" },
  { from: "bot", text: "that's a 5 day streak now. ur actually locked in fr fr" },
  { from: "bot", text: "keep this energy and u gonna be unrecognizable in 3 months. proud of u :)" },
  { from: "user", text: "thanks billie :)" },
];

// Conversation 5: Comeback
const comebackConversation: Message[] = [
  { from: "user", text: "i fell off so hard this week" },
  { from: "bot", text: "ok and? everyone falls off" },
  { from: "bot", text: "the difference between ppl who make it and ppl who don't is who gets back up" },
  { from: "user", text: "ur right" },
  { from: "bot", text: "ofc im right. now what's ONE thing u can do TODAY to get back on track?" },
  { from: "user", text: "go for a walk" },
  { from: "bot", text: "that's it. start small. text me when it's done :)" },
];

export const MarketingScreenshots = () => {
  return (
    <section className="py-24 sm:py-32 frost-bg relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-40 left-20 w-64 h-64 bg-ice/10 rounded-full blur-3xl" />
      <div className="absolute bottom-40 right-20 w-48 h-48 bg-ice/15 rounded-full blur-3xl" />
      
      <div className="container px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            real convos. real results.
          </h2>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            no corporate speak. just a friend who keeps it 100 and helps you lock in.
          </p>
        </motion.div>

        {/* First row - 3 conversations */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <ConversationMockup
            title="the intro"
            subtitle="billie's first impression"
            messages={introConversation}
            delay={0}
          />
          <ConversationMockup
            title="locking in goals"
            subtitle="setting up accountability"
            messages={goalSettingConversation}
            delay={0.1}
          />
          <ConversationMockup
            title="the roast"
            subtitle="when u slip up"
            messages={roastConversation}
            delay={0.2}
          />
        </div>

        {/* Second row - 2 conversations centered */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          <ConversationMockup
            title="the hype"
            subtitle="when u show up"
            messages={celebrationConversation}
            delay={0.3}
          />
          <ConversationMockup
            title="the comeback"
            subtitle="getting back on track"
            messages={comebackConversation}
            delay={0.4}
          />
        </div>
      </div>
    </section>
  );
};

export default MarketingScreenshots;
