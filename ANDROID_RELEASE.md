# Android Release Build Instructions

This document outlines the process for building and preparing Android App Bundles (AAB) for Google Play Console distribution.

## Prerequisites

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

The application uses machine learning models that are handled differently across build configurations:

- **Debug builds:** Models are bundled with the application
- **Release builds:** Models are distributed via Android Asset Packs to reduce APK size

## Build Process

### Automated Build Script

The recommended method for creating release builds is using the automated build script:

```bash
./scripts/build-release.sh
```

This script automatically handles the complete build process:

1. **Copies model files** from `assets/models/` to Android asset packs (`android/executorch_models/src/main/assets/`)
2. **Creates minimal placeholders** in the main assets directory to reduce bundle size
3. **Builds the release AAB** with real model files included via asset packs
4. **Restores original files** back to `assets/models/`
5. **Cleans up** Android asset pack directory

### Manual Build Process

If you prefer to build manually:

1. **Set Environment Variables**

   ```bash
   export NODE_ENV=production
   ```

2. **Copy Model Assets to Android Asset Packs**

   ```bash
   # Copy real model files to Android asset packs
   mkdir -p android/executorch_models/src/main/assets
   cp -r assets/models/* android/executorch_models/src/main/assets/
   ```

3. **Prepare Minimal Placeholders**

   ```bash
   # Replace tokenizer.json files with path placeholders
   find assets/models -name "tokenizer.json" -exec sh -c '
       rel_path=$(echo "$1" | sed "s|^assets/models/||")
       echo "{\"path\": \"$rel_path\"}" > "$1"
   ' _ {} \;

   # Replace other files with minimal placeholders
   find assets/models -name "*.json" ! -name "tokenizer.json" -exec sh -c 'echo "{}" > "$1"' _ {} \;
   find assets/models -name "*.pte" -exec sh -c 'printf "\0" > "$1"' _ {} \;
   ```

4. **Build the AAB**

   ```bash
   cd android
   ./gradlew bundleRelease
   cd ..
   ```

5. **Restore Original Model Files**
   ```bash
   # Copy files back from Android asset packs
   cp -r android/executorch_models/src/main/assets/* assets/models/

   # Clean up Android asset packs
   rm -rf android/executorch_models/src/main/assets/*
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

Check that model assets are not included in the bundle:

```bash
# Extract and inspect AAB contents if needed
```

## Google Play Console Upload

1. Navigate to Google Play Console
2. Select your application
3. Go to "Release" > "Production" (or appropriate track)
4. Upload the generated AAB file
5. Complete release notes and metadata
6. Submit for review

## Asset Packs Configuration

The application uses Android Asset Delivery for model distribution:

- Asset pack name: `executorch_models`
- Delivery type: Install-time
- Contains: Machine learning model files (.pte and .json files)
