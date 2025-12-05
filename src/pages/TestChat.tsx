import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Trash2, ArrowLeft, Lock, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  role: "user" | "billie";
  content: string;
}

interface UserState {
  name: string | null;
  onboarding_step: number;
  goals: string | null;
  subscription_status: string | null;
}

// Password is verified server-side only - never stored in client code

export default function TestChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userState, setUserState] = useState<UserState | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check localStorage for saved auth session
  useEffect(() => {
    const savedSession = localStorage.getItem("billie-test-session");
    if (savedSession) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Verify password server-side
      const { data, error } = await supabase.functions.invoke("test-chat", {
        body: { action: "verify-password", password: passwordInput },
      });

      if (error) throw error;

      if (data.authenticated) {
        setIsAuthenticated(true);
        // Store session token (not the password)
        localStorage.setItem("billie-test-session", data.sessionToken);
        toast.success("Access granted!");
      } else {
        toast.error("Wrong password");
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("Authentication failed");
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
      const sessionToken = localStorage.getItem("billie-test-session");
      const { data, error } = await supabase.functions.invoke("test-chat", {
        body: { message: userMessage, sessionToken },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setMessages((prev) => [...prev, { role: "billie", content: data.response }]);
      setUserState(data.user);

      // If just completed onboarding, show toast about payment
      if (data.justCompletedOnboarding) {
        toast.info("Onboarding complete! Payment link included in message.");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to get response. Try again.");
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const resetConversation = async () => {
    try {
      // Delete test user's messages first
      const { data: testUser } = await supabase
        .from("billie_users")
        .select("id")
        .eq("phone", "+1TEST000000")
        .maybeSingle();

      if (testUser) {
        await supabase
          .from("billie_messages")
          .delete()
          .eq("user_id", testUser.id);
      }

      // Then delete the test user
      await supabase
        .from("billie_users")
        .delete()
        .eq("phone", "+1TEST000000");
    } catch (e) {
      console.error("Error:", e);
    }

    setMessages([]);
    setUserState(null);
    toast.success("Conversation reset! Start fresh.");
  };

  // Password gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold">BILLIE Test Mode</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Enter password to access the test chat
            </p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
            />
            <Button type="submit" className="w-full">
              Access Test Chat
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/" className="text-sm text-muted-foreground hover:underline">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                BILLIE Test Chat
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  REAL FLOW
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Step {userState?.onboarding_step ?? 0}/5 • {userState?.name || "New User"}
                {userState?.subscription_status === "active" && " • 🟢 Subscribed"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={resetConversation}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title="Reset conversation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-2">
                This is the <strong>exact same flow</strong> as SMS
              </p>
              <p className="text-sm text-muted-foreground/70 mb-4">
                Same prompts, same memory, same state machine, same Stripe paywall
              </p>
              <p className="text-sm text-primary">
                Say "hey" to start onboarding →
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                }`}
              >
                {msg.content.split("\n\n").map((bubble, j) => {
                  // Check if this bubble contains a URL
                  const urlMatch = bubble.match(/(https?:\/\/[^\s]+)/);
                  if (urlMatch) {
                    const url = urlMatch[1];
                    const textBefore = bubble.substring(0, bubble.indexOf(url));
                    const textAfter = bubble.substring(bubble.indexOf(url) + url.length);
                    return (
                      <p key={j} className={j > 0 ? "mt-3" : ""}>
                        {textBefore}
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline inline-flex items-center gap-1"
                        >
                          pricing page <ExternalLink className="h-3 w-3" />
                        </a>
                        {textAfter}
                      </p>
                    );
                  }
                  return (
                    <p key={j} className={j > 0 ? "mt-3" : ""}>
                      {bubble}
                    </p>
                  );
                })}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span
                    className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* User State Debug */}
      {userState && (
        <div className="border-t border-border/50 bg-muted/30 px-4 py-2">
          <div className="max-w-2xl mx-auto text-xs text-muted-foreground flex flex-wrap gap-4">
            <span>Step: {userState.onboarding_step}</span>
            <span>Name: {userState.name || "—"}</span>
            <span className="truncate max-w-[200px]">
              Goals: {userState.goals || "—"}
            </span>
            <span>
              Sub: {userState.subscription_status || "none"}
            </span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/50 bg-card/50 backdrop-blur-sm">
        <form onSubmit={sendMessage} className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
              className="flex-1"
              autoFocus
            />
            <Button type="submit" disabled={!input.trim() || isLoading} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
