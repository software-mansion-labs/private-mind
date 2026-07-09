const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const {
  getBundleModeMetroConfig,
} = require('react-native-worklets/bundleMode');

let config = getDefaultConfig(__dirname);

const defaultResolver = config.resolver.resolveRequest;

config = getBundleModeMetroConfig(config);
const bundleModeResolveRequest = config.resolver.resolveRequest;

config.transformer.babelTransformerPath =
  require.resolve('react-native-svg-transformer/expo');
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== 'svg'
);
config.resolver.sourceExts.push('svg');
config.resolver.assetExts.push('pte');

config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, 'node_modules/react-native-worklets/.worklets'),
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('react-native-worklets/.worklets/')) {
    return bundleModeResolveRequest(context, moduleName, platform);
  }
  if (defaultResolver) {
    return defaultResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
