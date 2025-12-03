import { HeroSection } from "@/components/HeroSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { PhoneMockup } from "@/components/PhoneMockup";
import { FooterSection } from "@/components/FooterSection";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  return (
    <main className="min-h-screen">
      <ThemeToggle />
      <HeroSection />
      <HowItWorksSection />
      <PhoneMockup />
      <FooterSection />
    </main>
  );
};

export default Index;
