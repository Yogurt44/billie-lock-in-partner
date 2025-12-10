import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.fdad419e585e47a5a821647690fccb2e',
  appName: 'BILLIE',
  webDir: 'dist',
  server: {
    url: 'https://fdad419e-585e-47a5-a821-647690fccb2e.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
