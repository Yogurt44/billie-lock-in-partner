import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

export const WaitlistForm = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      toast.error("please enter a valid email 😅");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from("waitlist")
        .insert({ email: email.toLowerCase().trim() });

      if (error) {
        if (error.code === "23505") {
          toast.info("you're already on the list! we see u 👀");
        } else {
          throw error;
        }
      } else {
        setIsSubmitted(true);
        toast.success("you're in! BILLIE will hit u up soon 🔥");
      }
    } catch (error) {
      console.error("Waitlist error:", error);
      toast.error("something went wrong, try again");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-frost border border-ice/30"
      >
        <Sparkles className="w-5 h-5 text-ice" />
        <span className="text-foreground font-medium">you're on the list! 🎉</span>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto">
      <Input
        type="email"
        placeholder="drop ur email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 h-14 px-5 text-base bg-frost border-ice/30 placeholder:text-muted-foreground/60 focus:border-ice"
        disabled={isLoading}
      />
      <Button 
        type="submit" 
        variant="hero" 
        size="lg" 
        className="h-14 px-8"
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          "Join Waitlist"
        )}
      </Button>
    </form>
  );
};
