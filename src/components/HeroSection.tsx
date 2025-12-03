import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageSquare, Smartphone } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const PHONE_NUMBER = "+15555555555";
const SMS_BODY = "yo i needa lock in bro 😭";

export const HeroSection = () => {
  const isMobile = useIsMobile();
  
  const smsLink = `sms:${PHONE_NUMBER}&body=${encodeURIComponent(SMS_BODY)}`;

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
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-frost border border-ice/30 mb-8"
          >
            <span className="text-2xl">🥶</span>
            <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Winter 2025</span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight text-foreground mb-6"
          >
            Lock In
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-xl sm:text-2xl text-muted-foreground font-medium mb-12 max-w-xl mx-auto"
          >
            Your winter lock-in accountability partner — by text.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {isMobile ? (
              <Button asChild variant="hero" size="xl" className="group">
                <a href={smsLink}>
                  <MessageSquare className="mr-2 transition-transform group-hover:scale-110" />
                  Start Locking In
                </a>
              </Button>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Button variant="hero" size="xl" className="cursor-default">
                  <Smartphone className="mr-2" />
                  Text to Start
                </Button>
                <div className="glass px-6 py-3 rounded-xl">
                  <p className="text-sm text-muted-foreground mb-1">Send a text to</p>
                  <p className="text-xl font-bold tracking-wide text-foreground">{PHONE_NUMBER}</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* Social proof hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12 text-sm text-muted-foreground"
          >
            no app needed. just vibes, delusion, and accountability 🔒
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
};
