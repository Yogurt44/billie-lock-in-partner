import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import billieIcon from "@/assets/billie-icon.png";
import { Mail, ArrowRight, Loader2 } from "lucide-react";

export default function AppAuth() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
        },
      });

      if (error) throw error;

      toast.success("Check your email for the verification code!");
      setStep("verify");
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      toast.error(error.message || "Failed to send verification code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "email",
      });

      if (error) throw error;

      toast.success("You're in!");
      // Auth state change will handle redirect
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      toast.error(error.message || "Invalid code. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
        },
      });

      if (error) throw error;
      toast.success("New code sent!");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-4">
          <img 
            src={billieIcon} 
            alt="BILLIE" 
            className="w-20 h-20 rounded-2xl shadow-lg"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold">BILLIE</h1>
            <p className="text-muted-foreground text-sm">your accountability partner</p>
          </div>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-2">
              <p className="text-center text-sm text-muted-foreground">
                enter your email to get started
              </p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-10 h-12 rounded-xl"
                  disabled={isLoading}
                  autoFocus
                  required
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-base"
              disabled={!email.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  continue <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-2">
              <p className="text-center text-sm text-muted-foreground">
                enter the 6-digit code sent to<br />
                <span className="font-medium text-foreground">{email}</span>
              </p>
              <Input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="h-14 text-center text-2xl tracking-[0.5em] font-mono rounded-xl"
                disabled={isLoading}
                autoFocus
                maxLength={6}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl text-base"
              disabled={otp.length !== 6 || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "verify"
              )}
            </Button>
            <div className="flex justify-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                change email
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={isLoading}
                className="text-primary hover:underline"
              >
                resend code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
