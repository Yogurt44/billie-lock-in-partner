import { motion } from "framer-motion";
import { WaitlistForm } from "@/components/WaitlistForm";

export const FooterSection = () => {
  return (
    <footer className="py-24 sm:py-32 bg-midnight relative overflow-hidden">
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
          <p className="text-lg text-white/70 mb-10">
            no more "i'll start monday" bs. this is ur sign. let's lock in.
          </p>

          <WaitlistForm />

          {/* Footer links */}
          <div className="mt-16 pt-8 border-t border-white/10">
            <p className="text-sm text-white/50">
              © 2025 BILLIE. built for ppl who are done making excuses.
            </p>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};
