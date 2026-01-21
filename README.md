# Maternify App

## 📋 Prerequisites

Before running this project, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or later)
- [npm](https://www.npmjs.com/) or [Yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- [Android Studio](https://developer.android.com/studio) (for Android development)
- [Xcode](https://developer.apple.com/xcode/) (for iOS development, macOS only)

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd maternify-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the application

#### Development with Expo

```bash
# Start the Expo development server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on web
npm run web
```

### 🏗️ Expo Prebuild

This project uses Expo's managed workflow with prebuild for native code generation. The `android/` and `ios/` folders are generated automatically and should **not be edited directly** unless absolutely necessary.

```bash
# Generate native folders (run when needed)
expo prebuild

# Clean and regenerate native folders
expo prebuild --clean
```

**⚠️ Important Notes:**
- **Avoid editing native folders**: The `android/` and `ios/` directories are auto-generated
- **Use app.json**: Configure native settings through `app.json` or app config files
- **Plugins over manual edits**: Use Expo config plugins for native modifications
- **Clean builds**: Use `expo prebuild --clean` if you encounter native issues

**When you might need prebuild:**
- After adding new native dependencies
- When native configuration changes
- Before building for production
- When switching between development profiles

### 📦 Installing Libraries

When adding new libraries to your Expo project, always use the Expo CLI to ensure compatibility and proper configuration:

```bash
# ✅ RECOMMENDED: Use Expo CLI to install libraries
npx expo install <package-name>

# Examples:
npx expo install react-native-gesture-handler
npx expo install @react-navigation/native
npx expo install expo-camera
```

**Why use `expo install` instead of `npm install`?**
- **Version compatibility**: Ensures the package version is compatible with your Expo SDK
- **Automatic configuration**: Some packages are automatically configured
- **Peer dependencies**: Installs compatible versions of peer dependencies
- **Native dependencies**: Handles native dependencies properly

**For packages that require native code:**
```bash
# Install the package
npx expo install react-native-some-native-package

# Run prebuild to generate native code
expo prebuild

# For development builds
npx expo run:android
npx expo run:ios
```

**⚠️ Important:**
- Always use `npx expo install` for React Native and Expo-compatible packages
- Use `npm install` only for pure JavaScript packages that don't require native code
- Run `expo prebuild` after installing packages with native dependencies
- Check the [Expo SDK documentation](https://docs.expo.dev/) for package compatibility

## 📦 Creating a release

### 1. Update version and native build numbers
- Edit `app.config.ts` and update:
    - `version` (semantic app version)
    - `ios.buildNumber` (increment for each iOS release)
    - `android.versionCode` (increment for each Android release)
    - `android.versionName` (optional human-readable Android version)
- Regenerate native projects:
    ```sh
    npx expo prebuild
    ```

### 2. iOS — build and upload (Xcode)
1. Ensure you have appropriate Apple Developer signing credentials (provisioning profile, distribution certificate).
2. Open the generated workspace:
    ```sh
    open ios/<YourApp>.xcworkspace
    ```
3. Click on Product → Archive. Make sure to set the device to "Any iOS Device (arm64)".
4. After the archive is completed, in the archive window, click on Distribute App.


- Notes:
    - Increment `ios.buildNumber` for each upload.
    - Use Xcode’s automatic signing or configure manual signing with your team’s provisioning profiles.

### 3. Android — build and upload (Android Studio / Gradle)
TBA