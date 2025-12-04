#!/bin/bash

# Build script for Android APK
# Run this script after setting up Android Studio

echo "🏗️ Building Al-Ain Computers Android App..."

# Step 1: Build web app
echo "📦 Building web application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Web build failed!"
    exit 1
fi

echo "✅ Web build complete!"

# Step 2: Copy to Android
echo "📱 Copying to Android project..."
npx cap copy android

if [ $? -ne 0 ]; then
    echo "❌ Capacitor copy failed!"
    exit 1
fi

# Step 3: Sync plugins
echo "🔄 Syncing Capacitor plugins..."
npx cap sync android

if [ $? -ne 0 ]; then
    echo "❌ Capacitor sync failed!"
    exit 1
fi

echo "✅ Android project updated!"
echo ""
echo "Next steps:"
echo "1. Open Android Studio: npx cap open android"
echo "2. Wait for Gradle sync"
echo "3. Build > Build Bundle(s) / APK(s) > Build APK(s)"
echo ""
echo "For release APK, see: android/README.md"
