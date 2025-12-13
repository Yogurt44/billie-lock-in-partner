import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bell, Clock, Trash2, Sun, Moon, Monitor, LogOut, FileText, Shield, ExternalLink } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
  { value: "America/Anchorage", label: "Alaska (AKST)" },
];

export default function AppSettings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [checkInTime, setCheckInTime] = useState("09:00");
  const [timezone, setTimezone] = useState("America/New_York");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isResettingConversation, setIsResettingConversation] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    name: string | null;
    subscription_status: string | null;
    current_streak: number;
    longest_streak: number;
  } | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadSettings();
    }
  }, [user?.id]);

  const loadSettings = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke("app-chat", {
        body: { action: "get-settings", userId: user.id, userEmail: user.email },
      });

      if (error) throw error;

      if (data.settings) {
        setCheckInTime(data.settings.preferred_check_in_time || "09:00");
        setTimezone(data.settings.timezone || "America/New_York");
        setUserInfo({
          name: data.settings.name,
          subscription_status: data.settings.subscription_status,
          current_streak: data.settings.current_streak || 0,
          longest_streak: data.settings.longest_streak || 0,
        });
      }
    } catch (error) {
      console.log("Error loading settings:", error);
    }
  };

  const saveSettings = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke("app-chat", {
        body: {
          action: "save-settings",
          userId: user.id,
          userEmail: user.email,
          settings: {
            preferred_check_in_time: checkInTime,
            timezone,
          },
        },
      });

      if (error) throw error;
      toast.success("Settings saved!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsLoading(false);
    }
  };

  const resetConversation = async () => {
    if (!user?.id) return;
    setIsResettingConversation(true);

    try {
      const deviceId = localStorage.getItem("billie_device_id");
      const { error } = await supabase.functions.invoke("app-chat", {
        body: { action: "reset", deviceId: deviceId || `auth_${user.id}`, userEmail: user.email },
      });
      
      if (error) throw error;
      toast.success("Conversation reset! Starting fresh.");
      navigate("/app");
    } catch (error) {
      console.error("Error resetting:", error);
      toast.error("Failed to reset conversation");
    } finally {
      setIsResettingConversation(false);
    }
  };

  const deleteAccount = async () => {
    if (!user?.id || !user?.email) return;
    setIsDeletingAccount(true);
    
    try {
      const { error } = await supabase.functions.invoke("app-chat", {
        body: { 
          action: "delete-account", 
          userId: user.id, 
          userEmail: user.email 
        },
      });

      if (error) throw error;
      
      toast.success("Account deleted successfully");
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account. Please contact contact@trybillie.app");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/app/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/30 sticky top-0 z-10 safe-area-top">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/app")}
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-semibold text-lg">Settings</h1>
        </div>
      </header>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-8">
        {/* User Info */}
        {userInfo && (
          <div className="bg-card rounded-xl p-4 border border-border/50">
            <h2 className="font-medium mb-3">Your Stats</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium truncate">{user?.email || "Not set"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium">
                  {userInfo.subscription_status === "active" ? (
                    <span className="text-green-500">🟢 Subscribed</span>
                  ) : (
                    <span className="text-muted-foreground">Free</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Current Streak</p>
                <p className="font-medium text-orange-400">🔥 {userInfo.current_streak}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Best Streak</p>
                <p className="font-medium">{userInfo.longest_streak}</p>
              </div>
            </div>
          </div>
        )}

        {/* Appearance */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Label>Appearance</Label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("light")}
              className="flex items-center gap-2"
            >
              <Sun className="h-4 w-4" />
              Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme("dark")}
              className="flex items-center gap-2"
            >
              <Moon className="h-4 w-4" />
              Dark
            </Button>
          </div>
        </div>

        {/* Legal Links - Required by App Store */}
        <div className="pt-6 border-t border-border/50 space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Legal</h3>
          <Link to="/privacy" className="flex items-center justify-between p-3 bg-card rounded-lg border border-border/50 hover:bg-accent transition-colors">
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span>Privacy Policy</span>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Link to="/terms" className="flex items-center justify-between p-3 bg-card rounded-lg border border-border/50 hover:bg-accent transition-colors">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Terms of Service</span>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>

        {/* Account Actions */}
        <div className="pt-6 border-t border-border/50 space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Account</h3>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Reset Conversation History
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset conversation?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure? This will delete everything BILLIE knows about you - your goals, progress, and entire conversation history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={resetConversation}
                  disabled={isResettingConversation}
                >
                  {isResettingConversation ? "Resetting..." : "Reset Everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Danger Zone - Account Deletion (Required by App Store 5.1.1(v)) */}
        <div className="pt-6 border-t border-destructive/30 space-y-4">
          <h3 className="text-sm font-medium text-destructive mb-3">Danger Zone</h3>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>This action cannot be undone. This will permanently:</p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li>Delete your account and all personal data</li>
                    <li>Erase your entire conversation history</li>
                    <li>Remove all your goals and streak data</li>
                    <li>Cancel any active subscription</li>
                  </ul>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteAccount}
                  disabled={isDeletingAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeletingAccount ? "Deleting..." : "Delete Account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <p className="text-xs text-muted-foreground">
            Your data will be permanently deleted within 30 days. Any active subscription will be cancelled.
          </p>
        </div>

        {/* App Version */}
        <div className="pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            BILLIE v1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
