import type { CapacitorConfig } from '@capacitor/cli';

// Your live store website URL
const LIVE_WEBSITE_URL = 'https://aeen-iq.com';

const config: CapacitorConfig = {
  appId: 'com.alain.computers',
  appName: 'العين لتجارة الحاسبات',
  webDir: 'dist/public',
  server: {
    // The APK will load your live website (online store)
    url: LIVE_WEBSITE_URL,
    androidScheme: 'https',
    cleartext: false // Use HTTPS only for security
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0f0f0f',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      spinnerColor: '#dc2626'
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#0f0f0f'
    }
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;
