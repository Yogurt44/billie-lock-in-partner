import { HeroSection } from "@/components/HeroSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { PhoneMockup } from "@/components/PhoneMockup";
import { FooterSection } from "@/components/FooterSection";

const Index = () => {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <HowItWorksSection />
      <PhoneMockup />
      <FooterSection />
    </main>
  );
};

export default Index;
