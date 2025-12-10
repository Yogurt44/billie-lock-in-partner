import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Settings, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import billieIcon from "@/assets/billie-icon.png";

interface Message {
  role: "user" | "billie";
  content: string;
}

// Generate or get device ID for anonymous users
function getDeviceId(): string {
  let deviceId = localStorage.getItem("billie-device-id");
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem("billie-device-id", deviceId);
  }
  return deviceId;
}

export default function AppChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load previous messages on mount
  useEffect(() => {
    loadConversation();
    requestPushPermission();
  }, []);

  // Auto-start conversation if new user
  useEffect(() => {
    if (!hasStarted && messages.length === 0) {
      // Small delay to let the UI load, then BILLIE initiates
      const timer = setTimeout(() => {
        startConversation();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasStarted, messages.length]);

  const requestPushPermission = async () => {
    try {
      // Check if we're in a Capacitor environment
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('[Push] Permission granted');
          // In real Capacitor app, we'd use PushNotifications.register() here
        }
      }
    } catch (error) {
      console.log('[Push] Not available:', error);
    }
  };

  const loadConversation = async () => {
    try {
      const deviceId = getDeviceId();
      const { data, error } = await supabase.functions.invoke("app-chat", {
        body: { action: "load", deviceId },
      });

      if (error) throw error;

      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
        setHasStarted(true);
      }
    } catch (error) {
      console.log("No previous conversation found");
    }
  };

  const startConversation = async () => {
    if (hasStarted) return;
    setHasStarted(true);
    setIsLoading(true);

    try {
      const deviceId = getDeviceId();
      const { data, error } = await supabase.functions.invoke("app-chat", {
        body: { action: "start", deviceId, pushToken },
      });

      if (error) throw error;

      if (data.response) {
        setMessages([{ role: "billie", content: data.response }]);
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
      toast.error("Couldn't connect to BILLIE. Try again.");
      setHasStarted(false);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const deviceId = getDeviceId();
      const { data, error } = await supabase.functions.invoke("app-chat", {
        body: { message: userMessage, deviceId, pushToken },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setMessages((prev) => [...prev, { role: "billie", content: data.response }]);

      // Handle payment redirect
      if (data.paymentUrl) {
        // Open Stripe checkout in browser
        window.open(data.paymentUrl, '_blank');
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to send. Try again.");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Minimal iMessage style */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/30 sticky top-0 z-10 safe-area-top">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={billieIcon} 
              alt="BILLIE" 
              className="w-10 h-10 rounded-full"
            />
            <div>
              <h1 className="font-semibold text-base">BILLIE</h1>
              <p className="text-xs text-muted-foreground">your accountability partner</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/app/settings')}
            className="h-8 w-8 text-muted-foreground"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-2 max-w-3xl mx-auto">
          {messages.flatMap((msg, i) => {
            // Split BILLIE's messages into separate bubbles
            const bubbles = msg.role === "billie" 
              ? msg.content.split("\n\n").filter(b => b.trim())
              : [msg.content];
            
            return bubbles.map((bubble, j) => {
              const urlMatch = bubble.match(/(https?:\/\/[^\s]+)/);
              
              return (
                <div
                  key={`${i}-${j}`}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  style={{ 
                    animationDelay: msg.role === "billie" ? `${j * 100}ms` : "0ms",
                    animation: "fadeIn 0.2s ease-out forwards",
                    opacity: 0,
                  }}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted/80 rounded-bl-md"
                    }`}
                  >
                    {urlMatch ? (
                      <p>
                        {bubble.substring(0, bubble.indexOf(urlMatch[1]))}
                        <a
                          href={urlMatch[1]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          tap here <ExternalLink className="h-3 w-3" />
                        </a>
                        {bubble.substring(bubble.indexOf(urlMatch[1]) + urlMatch[1].length)}
                      </p>
                    ) : (
                      <p>{bubble}</p>
                    )}
                  </div>
                </div>
              );
            });
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted/80 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <span
                    className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input - iMessage style */}
      <div className="bg-card/80 backdrop-blur-xl border-t border-border/30 safe-area-bottom">
        <form onSubmit={sendMessage} className="px-4 py-3 max-w-3xl mx-auto">
          <div className="flex gap-2 items-end">
            <div className="flex-1 bg-muted/50 rounded-full border border-border/50">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message"
                disabled={isLoading}
                className="border-0 bg-transparent rounded-full focus-visible:ring-0 focus-visible:ring-offset-0 px-4"
                autoFocus
              />
            </div>
            <Button 
              type="submit" 
              disabled={!input.trim() || isLoading} 
              size="icon"
              className="rounded-full h-10 w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
