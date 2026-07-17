import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aiconx.app',
  appName: 'AiconX',
  webDir: 'dist',
  server: {
    // Load the live production origin instead of the bundled local assets so the
    // WebView runs under a real https://aiconx.onrender.com origin. This is required
    // for WebAuthn/biometric login to work at all inside the app: Android's WebView
    // only exposes navigator.credentials/PublicKeyCredential for an origin once it's
    // been verified via Digital Asset Links (see public/.well-known/assetlinks.json),
    // and that verification is only possible against a real, resolvable HTTPS domain —
    // never against the bundled "http://localhost" origin used previously.
    url: 'https://aiconx.onrender.com',
    androidScheme: 'https'
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
