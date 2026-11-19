#!/usr/bin/env bash
set -euo pipefail

if [ "$(uname)" != "Darwin" ] || ! command -v xcrun >/dev/null; then
  exit 0
fi

LIBS_DIR="$(cd "$(dirname "$0")/.." && pwd)/node_modules/react-native-pdfium/ios/libs/pdfium"
DEPLOYMENT_TARGET=17.0
SDK_VERSION=26.0
ABSL_SYMBOL='4absl|^_[Aa]bsl'

defines_global_absl() {
  xcrun nm -gU -arch all "$1" 2>/dev/null | awk 'NF==3 {print $3}' | grep -E "$ABSL_SYMBOL" > /dev/null
}

localize_arch() {
  local lib=$1 arch=$2 platform=$3 work=$4
  local thin="$work/$arch.a" linked="$work/$arch-linked.o" symbols="$work/$arch-absl.txt"
  local localized="$work/$arch-localized.o" out="$work/$arch-out.a"

  if [ "$(xcrun lipo -archs "$lib")" = "$arch" ]; then
    cp "$lib" "$thin"
  else
    xcrun lipo -thin "$arch" "$lib" -output "$thin"
  fi
  xcrun ld -r -arch "$arch" -platform_version "$platform" "$DEPLOYMENT_TARGET" "$SDK_VERSION" \
    -all_load "$thin" -keep_private_externs -w -o "$linked"
  xcrun nm -g "$linked" | awk 'NF==3 && $2!="U" {print $3}' | grep -E "$ABSL_SYMBOL" > "$symbols"
  xcrun nmedit -R "$symbols" "$linked" -o "$localized"
  xcrun libtool -static -no_warning_for_no_symbols -o "$out" "$localized"
  echo "$out"
}

localize_library() {
  local lib=$1 platform=$2
  [ -f "$lib" ] || return 0
  defines_global_absl "$lib" || return 0

  local work outputs=()
  work=$(mktemp -d)
  trap 'rm -rf "$work"' RETURN
  for arch in $(xcrun lipo -archs "$lib"); do
    outputs+=("$(localize_arch "$lib" "$arch" "$platform" "$work")")
  done
  xcrun lipo -create "${outputs[@]}" -output "$work/result.a"
  cp "$work/result.a" "$lib"
  echo "Localized Abseil symbols in $lib"
}

localize_library "$LIBS_DIR/simulator-arm64/libpdfium.a" ios-simulator
localize_library "$LIBS_DIR/physical-arm64/libpdfium.a" ios
