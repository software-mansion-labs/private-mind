// Bundle Mode enables worklet-runtime processing for react-native-streamdown.
//
// Note: react-native-streamdown@0.1.1 declares a peer dependency on
// react-native-worklets@0.8.0-bundle-mode-preview-2, but the stable
// 0.8.1 release is a drop-in replacement and exposes `bundleMode`
// through this plugin directly (no extra Podfile/gradle env var needed).
// If we upgrade streamdown past 0.1.x, re-check the peer matrix.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'react-native-worklets/plugin',
        {
          bundleMode: true,
          workletizableModules: ['remend'],
        },
      ],
    ],
  };
};
