#!/bin/bash

set -e

export NODE_ENV=production

ASSETS_DIR="assets/models"
ANDROID_ASSETS_DIR="android/executorch_models/src/main/assets"
AAB_OUTPUT="android/app/build/outputs/bundle/release/app-release.aab"

cleanup() {
    echo "Running cleanup..."
    echo "Restoring files from Android assets back to $ASSETS_DIR"
    if [ -d "$ANDROID_ASSETS_DIR" ]; then
        cp -r "$ANDROID_ASSETS_DIR"/* "$ASSETS_DIR"/ 2>/dev/null || echo "Warning: Could not copy some files"
        echo "Model files restored"
        echo "Removing files from Android asset packs..."
        rm -rf "$ANDROID_ASSETS_DIR"/*
        echo "Android asset packs cleaned"
    else
        echo "No Android assets directory found: $ANDROID_ASSETS_DIR"
    fi
    unset NODE_ENV
    echo "Cleanup complete"
}

trap cleanup EXIT

echo "Copying model files to Android asset packs..."
mkdir -p "$ANDROID_ASSETS_DIR"
if [ -d "$ASSETS_DIR" ]; then
    echo "Source assets directory contents:"
    ls -lh "$ASSETS_DIR"
    find "$ASSETS_DIR" -type f -exec ls -lh {} \; | head -20

    cp -r "$ASSETS_DIR"/* "$ANDROID_ASSETS_DIR"/ 2>/dev/null || true
    echo "Files copied to Android asset packs"

    echo "Android asset packs contents:"
    ls -lh "$ANDROID_ASSETS_DIR"
    find "$ANDROID_ASSETS_DIR" -type f -exec ls -lh {} \; | head -20
fi

echo "Replacing model files with minimal placeholder files..."
# Replace tokenizer.json files with path placeholders
find "$ASSETS_DIR" -name "tokenizer.json" -exec sh -c '
    rel_path=$(echo "$1" | sed "s|^$ASSETS_DIR/||")
    echo "{\"path\": \"$rel_path\"}" > "$1"
' _ {} \;
# Replace other .json files with empty JSON objects
find "$ASSETS_DIR" -name "*.json" ! -name "tokenizer.json" -exec sh -c 'echo "{}" > "$1"' _ {} \;
# Replace .pte files with minimal content (just a null byte)
find "$ASSETS_DIR" -name "*.pte" -exec sh -c 'printf "\0" > "$1"' _ {} \;

echo "Placeholder files created:"
find "$ASSETS_DIR" -type f -exec ls -lh {} \;

echo "Building Release AAB..."
echo "NODE_ENV is set to: $NODE_ENV"
cd android
echo "Running gradle bundleRelease with stacktrace..."
./gradlew bundleRelease --stacktrace --info 2>&1 | tee ../gradle-build.log
cd ..

if [ -f "$AAB_OUTPUT" ]; then
    echo "AAB built successfully: $AAB_OUTPUT"
    ls -lh "$AAB_OUTPUT"

    # Check bundle size
    AAB_SIZE=$(stat -f%z "$AAB_OUTPUT" 2>/dev/null || stat -c%s "$AAB_OUTPUT" 2>/dev/null)
    echo "Bundle size: $(echo "scale=2; $AAB_SIZE / 1024 / 1024" | bc 2>/dev/null || echo "$AAB_SIZE bytes") MB"
else
    echo "AAB build failed"
    exit 1
fi