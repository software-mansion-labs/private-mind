#!/bin/bash

set -e

export NODE_ENV=production

AAB_OUTPUT="android/app/build/outputs/bundle/release/app-release.aab"

cleanup() {
    unset NODE_ENV
}

trap cleanup EXIT

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
