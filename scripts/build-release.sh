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
    cp -r "$ASSETS_DIR"/* "$ANDROID_ASSETS_DIR"/ 2>/dev/null || true
    echo "Files copied to Android asset packs"
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

echo "Building Release AAB..."
echo "NODE_ENV is set to: $NODE_ENV"
cd android
echo "Running gradle bundleRelease..."
./gradlew bundleRelease
cd ..

if [ -f "$AAB_OUTPUT" ]; then
    echo "AAB built successfully: $AAB_OUTPUT"
    ls -lh "$AAB_OUTPUT"
else
    echo "AAB build failed"
    exit 1
fi