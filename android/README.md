# Android APK Build Instructions - العين لتجارة الحاسبات

## Important: This APK Connects to Your Online Store

This Android app loads your **live published website** (https://aeen-iq.com).
The app requires an internet connection to work.

## Quick Build Steps (5 minutes)

### Prerequisites
1. **Android Studio** - Download from https://developer.android.com/studio
2. **Java JDK 17+** - Usually included with Android Studio

### Step 1: Download This Project
1. Click the three dots menu (⋮) in Replit
2. Select "Download as zip"
3. Extract the zip file on your computer

### Step 2: Open Terminal in Project Folder
```bash
cd path/to/extracted/project
```

### Step 3: Install Dependencies & Build
```bash
npm install
npm run build
```

### Step 4: Add Android Platform
```bash
npx cap add android
npx cap sync android
```

### Step 5: Open in Android Studio
```bash
npx cap open android
```

### Step 6: Build APK
1. Wait for Gradle sync to complete (may take a few minutes first time)
2. Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**
3. Wait for build to complete
4. Click "locate" in the notification to find your APK

The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

## App Details

| Setting | Value |
|---------|-------|
| Package ID | `com.alain.computers` |
| App Name | العين لتجارة الحاسبات |
| Min Android | 5.1 (API 22) |
| Target Android | 14 (API 34) |
| Theme | Black (#0f0f0f) with Red accent |

## For Google Play Store (Release APK)

### Generate Signing Key
```bash
keytool -genkey -v -keystore alain-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias alain
```

### Build Signed APK
1. In Android Studio: **Build > Generate Signed Bundle/APK**
2. Select **APK**
3. Choose your keystore file and enter credentials
4. Select **release** build variant
5. Click **Create**

## Customizing App Icon

Replace these files in `android/app/src/main/res/`:
- `mipmap-mdpi/ic_launcher.png` (48x48 px)
- `mipmap-hdpi/ic_launcher.png` (72x72 px)
- `mipmap-xhdpi/ic_launcher.png` (96x96 px)
- `mipmap-xxhdpi/ic_launcher.png` (144x144 px)
- `mipmap-xxxhdpi/ic_launcher.png` (192x192 px)

## Troubleshooting

### "Gradle sync failed"
- Make sure Java JDK 17+ is installed
- In Android Studio: File > Settings > Build > Gradle > Gradle JDK > Select JDK 17

### "White screen on launch"
- Make sure you ran `npm run build` before `npx cap sync android`
- Check that `dist/public` folder exists

### "App crashes immediately"
- Check internet connection - the app needs internet to load the website
- Make sure https://aeen-iq.com is accessible
