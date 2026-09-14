# Release Guide

How to produce a release build of Private Mind for the App Store and Google
Play. Store submission itself follows each platform's standard flow and is not
repeated here.

## Version Bumping

A release touches four files. Missing one produces a build that reports the
wrong version.

### 1. App Version (Required)

**File:** [app.json](../app.json)

```json
{
  "expo": {
    "version": "1.3.0"
  }
}
```

### 2. Android Version Code (Required)

**File:** [android/app/build.gradle](../android/app/build.gradle)

`versionCode` must increase, and must exceed anything already uploaded to Play —
check _Release → App bundle explorer_. `versionName` matches `app.json`.

```gradle
defaultConfig {
    versionCode 69
    versionName "1.3.0"
}
```

### 3. iOS Version and Build Number (Required)

Two files carry it, and both must be updated:

- **[ios/PrivateMind/Info.plist](../ios/PrivateMind/Info.plist)** —
  `CFBundleShortVersionString` (matching `app.json`) and `CFBundleVersion`
  (increment). These are literal values, **not** `$(MARKETING_VERSION)`
  references, and they are what the built app reports.
- **[ios/PrivateMind.xcodeproj/project.pbxproj](../ios/PrivateMind.xcodeproj/project.pbxproj)** —
  `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`, twice each (Debug and
  Release). This is what Xcode's Organizer displays.

Editing only `project.pbxproj` produces a build that still reports the previous
version. Editing both keeps the Organizer and the app in agreement.

`CFBundleVersion` must be unused for that version in App Store Connect.

## Building

### Android

Build the App Store Bundle through the **Android Release** GitHub Actions
workflow — see [ANDROID_RELEASE.md](ANDROID_RELEASE.md) for the signing setup it
needs.

A local `./gradlew bundleRelease` is **not** a substitute. When
`android/local.properties` defines no `MYAPP_UPLOAD_STORE_FILE`, the release
build falls back to the debug keystore, and a bundle signed with the wrong key
is rejected on upload.

For a release build to install on a device over `adb`:

```bash
cd android
./gradlew :app:createBundleReleaseJsAndAssets --rerun-tasks
./gradlew assembleRelease
```

`--rerun-tasks` matters whenever an `EXPO_PUBLIC_*` variable changed: Gradle
does not treat environment variables as task inputs, so the bundle task is
otherwise skipped and the APK keeps the previous value.

### iOS

Archive in Xcode: open `ios/PrivateMind.xcworkspace` (the workspace, not the
project), select **Any iOS Device**, then **Product → Archive**. Distribute from
the Organizer window that opens.

The same from the command line, writing into the Organizer's archive directory:

```bash
cd ios && pod install && cd ..
xcodebuild -workspace ios/PrivateMind.xcworkspace -scheme PrivateMind \
  -configuration Release -destination "generic/platform=iOS" \
  -archivePath ~/Library/Developer/Xcode/Archives/<YYYY-MM-DD>/PrivateMind-<version>.xcarchive \
  -allowProvisioningUpdates archive
```

`pod install` rewrites `ios/Podfile.lock`; check it before committing, and
revert it if the only changes are paths.

## Release Notes

The in-app What's New card reads its copy from
[constants/latest-release.ts](../constants/latest-release.ts) and its version
number from the installed build. Keep the card and the store notes saying the
same thing.
