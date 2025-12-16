import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

const BILLIE_SMS_LINK = "sms:+18882051848";

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center hero-gradient overflow-hidden">
      {/* Icy background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-ice/20 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-ice/15 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-frost rounded-full blur-3xl opacity-60" />
        <div className="absolute top-40 right-1/4 w-48 h-48 bg-ice/25 rounded-full blur-2xl animate-float" />
      </div>

      <div className="container relative z-10 px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          {/* Intro copy */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-lg sm:text-xl text-muted-foreground mb-4"
          >
            Meet your new accountability partner.
          </motion.p>

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight text-foreground mb-8"
          >
            BILLIE
          </motion.h1>

          {/* Subtitle - simplified */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-xl sm:text-2xl text-muted-foreground font-medium mb-10 max-w-xl mx-auto"
          >
            keeping you locked in, daily.
          </motion.p>

          {/* SMS CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col items-center justify-center gap-4"
          >
            <Button asChild variant="hero" size="xl" className="group">
              <a href={BILLIE_SMS_LINK}>
                <MessageCircle className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
                Text BILLIE Now
              </a>
            </Button>
          </motion.div>

          {/* Value prop */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12 text-sm text-muted-foreground"
          >
            free to try • daily check-ins • streak tracking • no bs, just accountability 🔒
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
};
