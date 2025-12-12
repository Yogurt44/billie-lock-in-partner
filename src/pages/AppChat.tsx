import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Settings, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import billieIcon from "@/assets/billie-icon.png";
import { useMessageSound } from "@/hooks/useMessageSound";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";

interface Message {
  role: "user" | "billie";
  content: string;
}

// Random delay between 1-2 seconds to simulate real texting
function getRandomDelay(): number {
  return 1000 + Math.random() * 1000;
}

export default function AppChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  // Auth - get authenticated user
  const { user } = useAuth();
  const userId = user?.id;
  const userEmail = user?.email;
  
  // Sound effects and haptic feedback
  const { playMessageReceived, playSentSound } = useMessageSound();
  
  // Push notifications - use user ID instead of device ID
  const { token: pushToken } = usePushNotifications(userId || "");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load previous messages on mount (when user is available)
  useEffect(() => {
    if (userId) {
      loadConversation();
    }
  }, [userId]);

  // Auto-start conversation if new user (only after initialization check completes)
  useEffect(() => {
    if (userId && isInitialized && !hasStarted && messages.length === 0) {
      const timer = setTimeout(() => {
        startConversation();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [userId, isInitialized, hasStarted, messages.length]);

  // Add BILLIE messages one at a time with delays, sound, and haptics
  const addBillieMessagesWithDelay = async (response: string, paymentUrl?: string) => {
    const bubbles = response.split("\n\n").filter(b => b.trim());
    
    for (let i = 0; i < bubbles.length; i++) {
      // Show typing indicator before each message (except first, which already has it)
      if (i > 0) {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
      }
      
      // Play sound and haptic for each message
      playMessageReceived();
      
      setMessages(prev => [...prev, { role: "billie", content: bubbles[i] }]);
      setIsLoading(false);
      
      // Small pause between messages
      if (i < bubbles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // Handle payment redirect after all messages
    if (paymentUrl) {
      window.open(paymentUrl, '_blank');
    }
  };

  const loadConversation = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase.functions.invoke("app-chat", {
        body: { action: "load", userId, userEmail },
      });

      if (error) throw error;

      if (data.messages && data.messages.length > 0) {
        // For loaded messages, split BILLIE messages into individual bubbles
        const expandedMessages: Message[] = [];
        for (const msg of data.messages) {
          if (msg.role === "billie") {
            const bubbles = msg.content.split("\n\n").filter((b: string) => b.trim());
            bubbles.forEach((bubble: string) => {
              expandedMessages.push({ role: "billie", content: bubble });
            });
          } else {
            expandedMessages.push(msg);
          }
        }
        setMessages(expandedMessages);
        setHasStarted(true);
      }
    } catch (error) {
      console.log("No previous conversation found");
    } finally {
      setIsInitialized(true);
      setIsLoading(false);
    }
  };

  const startConversation = async () => {
    if (hasStarted || !userId) return;
    setHasStarted(true);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("app-chat", {
        body: { action: "start", userId, userEmail, pushToken },
      });

      if (error) throw error;

      if (data.response) {
        await addBillieMessagesWithDelay(data.response);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error starting conversation:", error);
      toast.error("Couldn't connect to BILLIE. Try again.");
      setHasStarted(false);
      setIsLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !userId) return;

    const userMessage = input.trim();
    setInput("");
    
    playSentSound();
    
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("app-chat", {
        body: { message: userMessage, userId, userEmail, pushToken },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        setIsLoading(false);
        return;
      }

      await addBillieMessagesWithDelay(data.response, data.paymentUrl);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to send. Try again.");
      setIsLoading(false);
    } finally {
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
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
          {messages.map((msg, i) => {
            const urlMatch = msg.content.match(/(https?:\/\/[^\s]+)/);
            
            return (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
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
                      {msg.content.substring(0, msg.content.indexOf(urlMatch[1]))}
                      <a
                        href={urlMatch[1]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        tap here <ExternalLink className="h-3 w-3" />
                      </a>
                      {msg.content.substring(msg.content.indexOf(urlMatch[1]) + urlMatch[1].length)}
                    </p>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start animate-fade-in">
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

      {/* Input */}
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
