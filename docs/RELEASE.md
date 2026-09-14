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

Xcode writes two files at once, and both are required:

- **[ios/PrivateMind/Info.plist](../ios/PrivateMind/Info.plist)** — `CFBundleShortVersionString` (match `app.json`) and `CFBundleVersion` (increment by 1). These are literal values, not `$(MARKETING_VERSION)` references, and they are what the built app reports.
- **[ios/PrivateMind.xcodeproj/project.pbxproj](../ios/PrivateMind.xcodeproj/project.pbxproj)** — `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`, twice each (Debug and Release).

Editing only `project.pbxproj` produces a build that still reports the previous version.

## Releasing 1.3.0, step by step

### 0. Before either store

1. **Merge the release branch.** Everything for 1.3.0 is in
   [#332](https://github.com/software-mansion-labs/private-mind/pull/332)
   (`release/1.3.0-final`), which supersedes #321, #326 and #327. Merge it into
   `main` first; the store builds are cut from what `main` holds.
2. **Confirm the numbers are the shipping ones**, not a test build's. On
   `release/1.3.0-final` they are already set:

   | Where                                                       | Value   |
   | ----------------------------------------------------------- | ------- |
   | `app.json` → `version`                                      | `1.3.0` |
   | `android/app/build.gradle` → `versionName`                  | `1.3.0` |
   | `android/app/build.gradle` → `versionCode`                  | `69`    |
   | `ios/PrivateMind/Info.plist` → `CFBundleShortVersionString` | `1.3.0` |
   | `ios/PrivateMind/Info.plist` → `CFBundleVersion`            | `5`     |

3. **Check both numbers are free.** A store rejects a build whose number is not
   higher than one it already has:
   - Google Play Console → _Release → App bundle explorer_ — the highest
     `versionCode` there must be **below 69**.
   - App Store Connect → _TestFlight_ — no build `5` may exist under version
     `1.3.0`.

   If either is taken, raise that one number only, in the files above, and
   commit before building.

### 1. Android — build the .aab

The bundle is built by GitHub Actions, because the upload keystore lives in
repository secrets and not on any machine.

1. GitHub → **Actions** → **Android Release**.
2. **Run workflow**, choosing the branch to build — `main` after the merge.
3. Wait for the run to finish (the job frees disk space, installs, decodes the
   keystore into `android/app/release.keystore`, writes `android/local.properties`
   from the secrets, and runs `scripts/build-release.sh`, which is
   `NODE_ENV=production ./gradlew bundleRelease`).
4. Download the artifact **`app-release-<run number>.aab`** from the finished
   run. It is kept for 30 days.

The workflow needs these repository secrets; a missing one fails the run rather
than producing an unsigned bundle: `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`,
`EXPO_PUBLIC_DETOUR_API_KEY`, `EXPO_PUBLIC_DETOUR_APP_ID`.

Do not build the upload bundle locally: a local `./gradlew bundleRelease` signs
with whatever `local.properties` points at, and a bundle signed with the wrong
key is rejected by Play.

### 2. Android — upload to Google Play

1. Play Console → **Private Mind** → **Release** → choose a track
   (_Internal testing_ to check the artifact first, _Production_ to ship).
2. **Create new release**.
3. Upload the `.aab` from the workflow artifact.
4. Release name: `1.3.0 (69)`.
5. Release notes: what the What's New card says — web search with sources, the
   per-chat Web toggle, sources you can open, the trace, on-device fetching, and
   models arriving without an app update.
6. **Next** → review warnings → **Start rollout**.

A staged rollout is worth it here: this release changes the chat send path and
the generation-completion path, and neither is covered by a test that would have
caught a regression.

### 3. iOS — archive and upload

Built locally, in Xcode, signed with team `J5FM626PE2`.

1. `open ios/PrivateMind.xcworkspace` — the workspace, never the `.xcodeproj`.
2. Scheme **PrivateMind**, destination **Any iOS Device (arm64)**. Archive is
   unavailable while a simulator is selected.
3. **Product → Archive**.
4. When the Organizer opens, confirm the row reads **1.3.0 (5)**. If it reads
   anything else, `Info.plist` was not updated — stop and fix it, because the
   archive carries what the plist says.
5. **Distribute App → App Store Connect → Upload**.
6. Keep the defaults (symbols included, manage signing automatically) and
   continue through to **Upload**.

### 4. iOS — submit in App Store Connect

1. App Store Connect → **Private Mind** → **TestFlight** — wait for the build to
   finish processing (minutes to an hour).
2. Answer the export-compliance question if prompted.
3. Test the TestFlight build on a device before submitting.
4. **App Store** tab → **+ Version or Platform** → `1.3.0`.
5. Fill in _What's New in This Version_ (same notes as Play), attach the
   processed build, then **Add for Review** → **Submit to App Review**.

### After both

Tag the commit that was built, so the artifacts can be traced back:

```
git tag -a v1.3.0 -m "Release 1.3.0" && git push origin v1.3.0
```

Then move `docs/ISSUES_1.3.0.md` items that did not make the release into
their issues, and close the ones that did.
