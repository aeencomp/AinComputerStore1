# Android APK Build Instructions

## Prerequisites

1. **Android Studio** (Download from https://developer.android.com/studio)
2. **Java JDK 17+**
3. **Node.js 18+**

## Building the APK

### Step 1: Build the Web App
```bash
npm run build
```

### Step 2: Initialize Capacitor Android
```bash
npx cap add android
```

### Step 3: Copy Web Assets to Android
```bash
npx cap copy android
```

### Step 4: Sync Capacitor Plugins
```bash
npx cap sync android
```

### Step 5: Open in Android Studio
```bash
npx cap open android
```

### Step 6: Build APK in Android Studio

1. Wait for Gradle sync to complete
2. Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**
3. The APK will be generated at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

### For Release APK (Google Play):

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
