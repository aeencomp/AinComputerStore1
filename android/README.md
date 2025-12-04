# Android APK Build Instructions - العين لتجارة الحاسبات

## Important: This APK Connects to Your Online Store

This Android app is configured to load your **live published website**. 
The app will NOT work offline - it requires internet connection to access your store.

**Before building, you MUST:**
1. Publish your website on Replit first
2. Update `capacitor.config.ts` with your published URL

## Prerequisites

1. **Android Studio** (Download from https://developer.android.com/studio)
2. **Java JDK 17+**
3. **Node.js 18+**
4. **Your published website URL** (e.g., https://your-app.replit.app)

## Step-by-Step Build Guide

### Step 1: Update Your Website URL

The URL is already configured in `capacitor.config.ts`:
```typescript
const LIVE_WEBSITE_URL = 'https://aeen-iq.com';
```

### Step 2: Build the Web App
```bash
npm run build
```

### Step 3: Initialize Capacitor Android
```bash
npx cap add android
```

### Step 4: Copy Web Assets to Android
```bash
npx cap copy android
```

### Step 5: Sync Capacitor Plugins
```bash
npx cap sync android
```

### Step 6: Open in Android Studio
```bash
npx cap open android
```

### Step 7: Build APK in Android Studio

1. Wait for Gradle sync to complete
2. Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**
3. The APK will be generated at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

## For Release APK (Google Play):

1. Generate a signing key:
```bash
keytool -genkey -v -keystore alain-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias alain
```

2. In Android Studio:
   - Go to **Build > Generate Signed Bundle/APK**
   - Select **APK**
   - Choose your keystore and enter credentials
   - Select **release** build variant
   - Build

## App Configuration

- **Package ID**: `com.alain.computers`
- **App Name**: العين لتجارة الحاسبات
- **Min SDK**: 22 (Android 5.1)
- **Target SDK**: 34 (Android 14)

## Customizing Icons

Replace the following files in `android/app/src/main/res/`:
- `mipmap-mdpi/ic_launcher.png` (48x48)
- `mipmap-hdpi/ic_launcher.png` (72x72)
- `mipmap-xhdpi/ic_launcher.png` (96x96)
- `mipmap-xxhdpi/ic_launcher.png` (144x144)
- `mipmap-xxxhdpi/ic_launcher.png` (192x192)

## Splash Screen

The splash screen is configured in `capacitor.config.ts` with:
- Background color: #0891b2 (cyan)
- White spinner during loading

## Server URL for Development

To test against your development server:
1. Set `CAPACITOR_SERVER_URL` environment variable to your Replit URL
2. Run `npx cap copy android`

## Troubleshooting

### Gradle Sync Failed
- Ensure Java JDK 17+ is installed
- Check Android Studio SDK Manager for required SDK versions

### White Screen on App Launch
- Check that `dist/public` folder exists after build
- Verify `webDir` in `capacitor.config.ts` matches your build output

### Network Requests Failing
- `cleartext: true` is enabled for development
- For production, ensure your server uses HTTPS
