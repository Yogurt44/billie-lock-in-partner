import { motion } from "framer-motion";
import { MessageCircle, Target, CheckCircle2 } from "lucide-react";

const steps = [
  {
    icon: MessageCircle,
    number: "01",
    title: "Text us",
    description: "Send a message to start. Lock In will roast u + ask ur name.",
    emoji: "📱",
  },
  {
    icon: Target,
    number: "02",
    title: "Tell us your goals",
    description: "Drop your goals for the next 3 months — list as many as u want. Be delusional but realistic.",
    emoji: "🎯",
  },
  {
    icon: CheckCircle2,
    number: "03",
    title: "Check in daily",
    description: "Text 'check in' and we'll hold u accountable. No corporate energy. Just vibes & results.",
    emoji: "✅",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
};

export const HowItWorksSection = () => {
  return (
    <section className="py-24 sm:py-32 bg-background relative">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-frost/50 to-transparent pointer-events-none" />
      
      <div className="container relative z-10 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            How it works
          </h2>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Three steps to becoming that person who actually follows through.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
        >
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              variants={itemVariants}
              className="group relative"
            >
              <div className="glass rounded-2xl p-8 h-full card-shadow hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                {/* Number badge */}
                <div className="absolute -top-3 -left-3 w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                  {step.number}
                </div>

                {/* Emoji */}
                <div className="text-4xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  {step.emoji}
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Connector line (hidden on mobile, shown between cards) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 border-t-2 border-dashed border-border" />
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
