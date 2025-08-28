const { getDefaultConfig } = require('expo/metro-config');
const { ensureModelAssets } = require('./assets/models/download-models.mjs');

module.exports = (async () => {
  await ensureModelAssets();

  const config = getDefaultConfig(__dirname);

  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
  };
  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...resolver.sourceExts, 'svg'],
  };

  config.resolver.assetExts.push('pte');

  return config;
})();
