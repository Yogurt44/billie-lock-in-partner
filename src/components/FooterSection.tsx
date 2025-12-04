import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageSquare, Smartphone } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const PHONE_NUMBER = "+15555555555";
const SMS_BODY = "yo i needa lock in bro 😭";

export const FooterSection = () => {
  const isMobile = useIsMobile();
  const smsLink = `sms:${PHONE_NUMBER}&body=${encodeURIComponent(SMS_BODY)}`;

  return (
    <footer className="py-24 sm:py-32 bg-midnight text-primary-foreground relative overflow-hidden">
      {/* Icy background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-64 h-64 bg-ice/15 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute bottom-10 left-10 w-48 h-48 bg-ice/10 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-ice/5 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mx-auto"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            stop scrolling. text BILLIE.
          </h2>
          <p className="text-lg text-primary-foreground/70 mb-10">
            no more "i'll start monday" bs. this is ur sign. let's lock in.
          </p>

          {isMobile ? (
            <Button asChild variant="ice" size="xl" className="group">
              <a href={smsLink}>
                <MessageSquare className="mr-2 transition-transform group-hover:scale-110" />
                Start Locking In
              </a>
            </Button>
          ) : (
            <div className="inline-flex flex-col items-center gap-4">
              <Button variant="ice" size="xl" className="cursor-default">
                <Smartphone className="mr-2" />
                Text to Start
              </Button>
              <div className="px-6 py-3 rounded-xl bg-primary-foreground/10 backdrop-blur-sm border border-primary-foreground/20">
                <p className="text-sm text-primary-foreground/70 mb-1">Send a text to</p>
                <p className="text-xl font-bold tracking-wide">{PHONE_NUMBER}</p>
              </div>
            </div>
          )}

          {/* Footer links */}
          <div className="mt-16 pt-8 border-t border-primary-foreground/10">
            <p className="text-sm text-primary-foreground/50">
              © 2025 BILLIE. built for ppl who are done making excuses.
            </p>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};
