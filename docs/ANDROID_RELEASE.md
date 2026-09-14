# Android Release Build Instructions

This document outlines the process for building and preparing Android App Bundles (AAB) for Google Play Console distribution.

## Recommended: GitHub Actions (CI/CD)

**The preferred method is to build via GitHub Actions**, which handles all setup automatically and produces a downloadable AAB artifact.

### Steps:

1. Ensure version numbers are updated (see [RELEASE.md](./RELEASE.md))
2. Go to **GitHub** → **Actions** → **"Android Release"**
3. Click **"Run workflow"**
4. Wait for the build to complete (~10-15 minutes)
5. Download the AAB from **Artifacts** section at the bottom of the workflow run page
6. Upload to Google Play Console manually

### Required GitHub Secrets

The following secrets must be configured in your repository (Settings → Secrets and variables → Actions):

- `ANDROID_KEYSTORE_BASE64` - Your release keystore file (base64 encoded)
- `ANDROID_KEYSTORE_PASSWORD` - Keystore password
- `ANDROID_KEY_ALIAS` - Key alias
- `ANDROID_KEY_PASSWORD` - Key password
- `EXPO_PUBLIC_DETOUR_API_KEY` - Detour SDK API key
- `EXPO_PUBLIC_DETOUR_APP_ID` - Detour SDK App ID

---

## Alternative: Local Build

If you need to build locally instead of using GitHub Actions, follow these instructions.

### Prerequisites

### 1. Development Environment

- Android SDK installed and configured
- Java/Kotlin development environment
- React Native CLI tools
- Node.js and yarn/npm

### 2. Signing Configuration

Ensure you have a valid Android keystore for app signing. The keystore credentials should be configured in `android/local.properties`:

```properties
MYAPP_UPLOAD_STORE_FILE=your_keystore_file.jks
MYAPP_UPLOAD_STORE_PASSWORD=your_keystore_password
MYAPP_UPLOAD_KEY_ALIAS=your_key_alias
MYAPP_UPLOAD_KEY_PASSWORD=your_key_password
```

**Important:** The `local.properties` file is excluded from version control for security reasons.

### 3. Model Assets

No model files ship with the app. Every model — LLMs and the embedding model used
for document search — is downloaded on device from Hugging Face on first use, so
the AAB contains no `.pte` files and needs no asset packs.

## Build Process

### Automated Build Script

The recommended method for creating release builds is using the automated build script:

```bash
./scripts/build-release.sh
```

### Manual Build Process

If you prefer to build manually:

1. **Set Environment Variables**

   ```bash
   export NODE_ENV=production
   ```

2. **Build the AAB**

   ```bash
   cd android
   ./gradlew bundleRelease
   cd ..
   ```

## Output Location

The signed AAB will be generated at:

```
android/app/build/outputs/bundle/release/app-release.aab
```

## Verification

### 1. Signing Verification

Verify the AAB is signed with the correct keystore:

```bash
cd android
./gradlew signingReport | grep -A10 "Variant: release"
```

### 2. Content Verification

Check that no model files ended up in the bundle:

```bash
unzip -l android/app/build/outputs/bundle/release/app-release.aab | grep -i '\.pte' || echo "No model files bundled"
```

## Google Play Console Upload

1. Navigate to Google Play Console
2. Select your application
3. Go to "Release" > "Production" (or appropriate track)
4. Upload the generated AAB file
5. Complete release notes and metadata
6. Submit for review
