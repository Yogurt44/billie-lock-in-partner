import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Capacitor } from "@capacitor/core";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PaymentSuccess from "./pages/PaymentSuccess";
import Pricing from "./pages/Pricing";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import SMSConsent from "./pages/SMSConsent";
import TestChat from "./pages/TestChat";
import AppChat from "./pages/AppChat";
import AppSettings from "./pages/AppSettings";
import AppAuth from "./pages/AppAuth";
import { useAuth } from "./hooks/useAuth";

const queryClient = new QueryClient();

// Detect if running inside native Capacitor app
const isNativeApp = Capacitor.isNativePlatform();

// Protected route wrapper
function ProtectedApp({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/app/auth" replace />;
  }
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Native app skips landing page, goes directly to chat */}
            <Route path="/" element={isNativeApp ? <Navigate to="/app" replace /> : <Index />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/sms-consent" element={<SMSConsent />} />
            <Route path="/test" element={<TestChat />} />
            <Route path="/app/auth" element={<AppAuth />} />
            <Route path="/app" element={<ProtectedApp><AppChat /></ProtectedApp>} />
            <Route path="/app/settings" element={<ProtectedApp><AppSettings /></ProtectedApp>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;