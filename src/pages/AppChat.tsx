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

// Get stored device token (secure auth token from server)
function getDeviceToken(): string | null {
  return localStorage.getItem("billie-device-token");
}

// Store device token from server
function setDeviceToken(token: string): void {
  localStorage.setItem("billie-device-token", token);
}

// Clear device token (for reset)
function clearDeviceToken(): void {
  localStorage.removeItem("billie-device-token");
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
  
  // Sound effects and haptic feedback
  const { playMessageReceived, playSentSound } = useMessageSound();
  
  // Push notifications
  const deviceId = getDeviceId();
  const { token: pushToken } = usePushNotifications(deviceId);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load previous messages on mount
  useEffect(() => {
    loadConversation();
  }, []);

  // Auto-start conversation if new user (only after initialization check completes)
  useEffect(() => {
    if (isInitialized && !hasStarted && messages.length === 0) {
      const timer = setTimeout(() => {
        startConversation();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isInitialized, hasStarted, messages.length]);

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
    try {
      const { data, error } = await supabase.functions.invoke("app-chat", {
        body: { action: "load", deviceId },
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
    }
  };

  const startConversation = async () => {
    if (hasStarted) return;
    setHasStarted(true);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("app-chat", {
        body: { action: "start", deviceId, pushToken },
      });

      if (error) throw error;

      // Store the device token for future authenticated requests
      if (data.deviceToken) {
        setDeviceToken(data.deviceToken);
      }

      if (data.response) {
        await addBillieMessagesWithDelay(data.response);
      } else {
        // No response means returning user - just clear loading state
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
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    
    // Play sent sound
    playSentSound();
    
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const deviceToken = getDeviceToken();
      
      const { data, error } = await supabase.functions.invoke("app-chat", {
        body: { message: userMessage, deviceId, deviceToken, pushToken },
      });

      if (error) throw error;

      // Handle token errors - need to re-authenticate
      if (data.code === 'TOKEN_REQUIRED' || data.code === 'INVALID_TOKEN') {
        // Clear old token and restart conversation to get new token
        clearDeviceToken();
        toast.error("Session expired. Please restart the conversation.");
        setIsLoading(false);
        return;
      }

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
