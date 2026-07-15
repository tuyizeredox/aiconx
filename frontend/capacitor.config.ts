import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aiconx.app',
  appName: 'AiconX',
  webDir: 'dist',
  server: {
    // Default https scheme blocks calls to plain-http backends as mixed content.
    androidScheme: 'http'
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      // NOTE: despite the plugin's README documenting "serverClientId", its actual
      // Android native code (GoogleAuth.java initialize()) only reads "clientId" /
      // "androidClientId" — "serverClientId" is silently ignored there, which left
      // it falling back to the plugin's own placeholder string. Must be the WEB
      // application OAuth client (matches VITE_GOOGLE_CLIENT_ID / backend
      // GOOGLE_CLIENT_ID) — NOT the Android client's own ID. The Android client
      // (package name + SHA-1, registered separately in Cloud Console) only
      // authorizes the calling app; its client ID is never referenced here.
      clientId: '526100733591-d9eqlnh36q0vkkcv009g0t7bohs58k2b.apps.googleusercontent.com'
    }
  }
};

export default config;
