#!/bin/bash

set -euo pipefail

AAB_PATH="${1:?usage: verify-aab-abis.sh <path-to-aab>}"
REQUIRED_LIBS=(libexecutorch.so libRnExecutorch.so libpdfium.so)

entries="$(unzip -Z1 "$AAB_PATH")"
abis="$(echo "$entries" | sed -n 's|^base/lib/\([^/]*\)/.*|\1|p' | sort -u)"

if [ -z "$abis" ]; then
    echo "No native libraries found in $AAB_PATH"
    exit 1
fi

incomplete=0
for abi in $abis; do
    for lib in "${REQUIRED_LIBS[@]}"; do
        if ! grep -qx "base/lib/$abi/$lib" <<< "$entries"; then
            echo "ABI $abi ships without $lib"
            incomplete=1
        fi
    done
done

if [ "$incomplete" -ne 0 ]; then
    echo "Every ABI in the bundle must carry the on-device AI libraries;"
    echo "drop the incomplete ABI from reactNativeArchitectures in android/gradle.properties."
    exit 1
fi

echo "Native libraries complete for: $(echo $abis | tr '\n' ' ')"
