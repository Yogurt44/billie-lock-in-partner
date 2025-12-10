import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

interface PushNotificationState {
  token: string | null;
  isSupported: boolean;
}

export function usePushNotifications(deviceId: string) {
  const [state, setState] = useState<PushNotificationState>({
    token: null,
    isSupported: false,
  });

  useEffect(() => {
    initializePushNotifications();
  }, [deviceId]);

  const initializePushNotifications = async () => {
    // Check if we're in a native Capacitor environment
    if (Capacitor.isNativePlatform()) {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        
        // Request permission
        const permResult = await PushNotifications.requestPermissions();
        
        if (permResult.receive === "granted") {
          // Register with APNS/FCM
          await PushNotifications.register();
          
          // Listen for registration success
          PushNotifications.addListener("registration", async (token) => {
            console.log("[Push] Token received:", token.value);
            setState({ token: token.value, isSupported: true });
            
            // Save token to backend
            await savePushToken(token.value);
          });
          
          // Listen for registration errors
          PushNotifications.addListener("registrationError", (error) => {
            console.error("[Push] Registration error:", error);
          });
          
          // Listen for push notifications received
          PushNotifications.addListener("pushNotificationReceived", (notification) => {
            console.log("[Push] Notification received:", notification);
          });
          
          // Listen for push notification actions (when user taps)
          PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
            console.log("[Push] Action performed:", action);
            // Navigate to chat when notification is tapped
            window.location.href = "/app";
          });
          
          setState(prev => ({ ...prev, isSupported: true }));
        }
      } catch (error) {
        console.log("[Push] Native push not available:", error);
      }
    } else {
      // Web push notifications fallback
      if ("Notification" in window && "serviceWorker" in navigator) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === "granted") {
            setState({ token: null, isSupported: true });
            console.log("[Push] Web notifications enabled");
          }
        } catch (error) {
          console.log("[Push] Web notifications not available:", error);
        }
      }
    }
  };

  const savePushToken = async (token: string) => {
    try {
      await supabase.functions.invoke("app-chat", {
        body: { 
          action: "save-push-token", 
          deviceId, 
          pushToken: token 
        },
      });
      console.log("[Push] Token saved to backend");
    } catch (error) {
      console.error("[Push] Failed to save token:", error);
    }
  };

  return state;
}