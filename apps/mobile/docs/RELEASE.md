# Release Guide

This guide covers the process for releasing new versions of Private Mind to the App Store and Google Play Store.

## Version Bumping

Before creating a release, update the version number in the following locations:

### 1. App Version (Required)

**File:** [app.json](../app.json)

Update the `version` field:

```json
{
  "expo": {
    "version": "1.1.4"
  }
}
```

### 2. Android Version Code (Required)

**File:** [android/app/build.gradle](../android/app/build.gradle)

Update both `versionCode` (increment by 1) and `versionName` (match app.json):

```gradle
defaultConfig {
    versionCode 60        // Increment this
    versionName "1.1.4"   // Match app.json version
}
```

### 3. iOS Build Number (Required)

The build number should be set in `info` and `general` sections in Xcode, ensure the version matches `app.json`.

## Platform-Specific Release Instructions

### Android Release

Android builds are automated via GitHub Actions. See [ANDROID_RELEASE.md](../ANDROID_RELEASE.md) for detailed instructions.

**Quick Steps:**

1. Update version numbers (see above)
2. Commit and push changes
3. Go to GitHub Actions "Android Release"
4. Run workflow manually
5. Download the generated `.aab` file from workflow artifacts
6. Upload to Google Play Console manually

### iOS Release

iOS builds are created locally using Xcode.

**Steps:**

1. Update version numbers (see above)
2. Open `ios/PrivateMind.xcworkspace` in Xcode
3. Select "Any iOS Device" as the build target
4. Choose **Product** -> **Archive**
5. Once archiving completes, the Organizer window will open
6. Click **Distribute App**
7. Select **App Store Connect** -> **Upload**
8. Follow the prompts to upload to TestFlight/App Store

For detailed iOS publishing instructions, refer to the [React Native Publishing to App Store guide](https://reactnative.dev/docs/publishing-to-app-store).
