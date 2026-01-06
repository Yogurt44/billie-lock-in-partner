import { HeroSection } from "@/components/HeroSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { MarketingScreenshots } from "@/components/MarketingScreenshots";
import { FooterSection } from "@/components/FooterSection";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  return (
    <main className="min-h-screen">
      <ThemeToggle />
      <HeroSection />
      <HowItWorksSection />
      <MarketingScreenshots />
      <FooterSection />
    </main>
  );
};

export default Index;
