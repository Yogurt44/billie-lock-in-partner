import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

const BILLIE_NUMBER = "+1 (888) 205-1848";
const BILLIE_SMS_LINK = "sms:+18882051848";

export const FooterSection = () => {
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
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-white">
            stop scrolling. text BILLIE.
          </h2>
          <p className="text-lg text-white/80 mb-6">
            no more "i'll start monday" bs. this is ur sign. let's lock in.
          </p>

          {/* Phone Number */}
          <a 
            href={BILLIE_SMS_LINK}
            className="inline-block text-2xl sm:text-3xl font-bold text-ice hover:text-ice/80 transition-colors mb-8"
          >
            {BILLIE_NUMBER}
          </a>

          <div className="flex flex-col items-center justify-center gap-4">
            <Button asChild variant="ice" size="xl" className="group">
              <a href={BILLIE_SMS_LINK}>
                <MessageCircle className="mr-2 h-5 w-5 transition-transform group-hover:scale-110" />
                Text BILLIE Now
              </a>
            </Button>
          </div>

          {/* Footer links */}
          <div className="mt-16 pt-8 border-t border-primary-foreground/10">
            <div className="flex flex-wrap justify-center gap-6 mb-4 text-sm text-white/60">
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/sms-consent" className="hover:text-white transition-colors">SMS Consent</Link>
            </div>
            <p className="text-sm text-white/60">
              © 2025 BILLIE. built for ppl who are done making excuses.
            </p>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};