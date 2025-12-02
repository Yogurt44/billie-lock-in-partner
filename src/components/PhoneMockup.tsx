import { motion } from "framer-motion";

const messages = [
  { from: "user", text: "yo i needa lock in bro 😭", delay: 0 },
  { from: "bot", text: "yo what should I call u 😭", delay: 0.3 },
  { from: "user", text: "Marcus", delay: 0.6 },
  { from: "bot", text: "ok bet Marcus. what's ur ONE non-negotiable habit this winter? be fr.", delay: 0.9 },
  { from: "user", text: "go to the gym 4x a week", delay: 1.2 },
  { from: "bot", text: "say less. ur 1 Thing is: go to the gym 4x a week 🔒 text 'check in' whenever u wanna be held accountable.", delay: 1.5 },
];

export const PhoneMockup = () => {
  return (
    <section className="py-24 sm:py-32 frost-bg">
      <div className="container px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Real convo energy
          </h2>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            No corporate BS. Just straight talk.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-sm mx-auto"
        >
          {/* Phone frame */}
          <div className="relative bg-midnight rounded-[3rem] p-3 card-shadow">
            {/* Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-midnight rounded-b-3xl z-20" />
            
            {/* Screen */}
            <div className="bg-background rounded-[2.5rem] overflow-hidden">
              {/* Status bar */}
              <div className="h-12 bg-card flex items-center justify-center">
                <span className="text-sm font-medium text-foreground">Lock In 🔒</span>
              </div>

              {/* Messages */}
              <div className="p-4 space-y-3 min-h-[400px] bg-frost/30">
                {messages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: msg.delay }}
                    className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                        msg.from === "user"
                          ? "bg-ice text-accent-foreground rounded-br-md"
                          : "bg-card text-card-foreground rounded-bl-md card-shadow"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Input bar */}
              <div className="h-14 bg-card border-t border-border flex items-center px-4">
                <div className="flex-1 h-9 bg-muted rounded-full px-4 flex items-center">
                  <span className="text-sm text-muted-foreground">iMessage</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
