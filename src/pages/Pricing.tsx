import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const plans = [
  {
    id: "monthly",
    name: "Monthly",
    price: "$9.99",
    period: "/month",
    description: "Perfect for trying BILLIE out",
    features: [
      "Daily accountability check-ins",
      "Personalized goal tracking",
      "Real-time SMS support",
      "Progress insights",
    ],
    popular: false,
  },
  {
    id: "annual",
    name: "Annual",
    price: "$79.99",
    period: "/year",
    description: "Best value — save $40",
    features: [
      "Everything in Monthly",
      "Priority response times",
      "Advanced goal analytics",
      "2 months FREE",
    ],
    popular: true,
    savings: "Save $40/year",
  },
];

export default function Pricing() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  
  const userId = searchParams.get("user_id");
  const phone = searchParams.get("phone");

  const handleSelectPlan = async (planId: string) => {
    if (!userId || !phone) {
      toast.error("Missing user information. Please use the link from your SMS.");
      return;
    }

    setLoading(planId);
    
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { user_id: userId, phone, plan: planId },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen hero-gradient">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
            <Snowflake className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-foreground/80">Choose your plan</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            lock in with <span className="text-accent">BILLIE</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            your accountability partner is ready. pick a plan and let's get you crushing your goals fr 🔥
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-8 transition-all duration-300 ${
                plan.popular
                  ? "bg-card border-2 border-accent card-shadow scale-[1.02]"
                  : "bg-card/50 border border-border hover:border-accent/50"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1 rounded-full bg-accent text-accent-foreground text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}

              {plan.savings && (
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-semibold">
                    {plan.savings}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-foreground mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-accent" />
                    </div>
                    <span className="text-sm text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loading !== null}
                className={`w-full ${
                  plan.popular
                    ? "bg-accent hover:bg-accent/90 text-accent-foreground"
                    : "bg-primary hover:bg-primary/90"
                }`}
              >
                {loading === plan.id ? "Loading..." : `Get ${plan.name}`}
              </Button>
            </div>
          ))}
        </div>

        {/* Trust badge */}
        <p className="text-center text-sm text-muted-foreground mt-12">
          🔒 Secure payment powered by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
