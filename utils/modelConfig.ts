import { Platform } from 'react-native';
import {
  copyFileAssets,
  DocumentDirectoryPath,
  exists,
} from '@dr.pogodin/react-native-fs';

export interface ModelSourceConfig {
  decoderSource?: string;
  encoderSource?: string;
  tokenizerSource?: string;
  modelSource?: string;
}

export interface ModelDefinition {
  assetPackName: string;
  assetFiles: ModelSourceConfig;
  assetPackFiles: ModelSourceConfig;
}

export enum ModelSourceStrategy {
  BUNDLED_ASSETS = 'bundled_assets',
  ASSET_PACK_COPY = 'asset_pack_copy',
}

export const WHISPER_TINY_EN_MODEL: ModelDefinition = {
  assetPackName: 'whisper-tiny-en',
  assetFiles: {
    decoderSource: require('../assets/models/whisper-tiny-en/whisper_tiny_en_decoder_xnnpack.pte'),
    encoderSource: require('../assets/models/whisper-tiny-en/whisper_tiny_en_encoder_xnnpack.pte'),
    tokenizerSource: require('../assets/models/whisper-tiny-en/tokenizer.json'),
  },
  assetPackFiles: {
    decoderSource: 'whisper_tiny_en_decoder_xnnpack.pte',
    encoderSource: 'whisper_tiny_en_encoder_xnnpack.pte',
    tokenizerSource: 'tokenizer.json',
  },
};

export const ALL_MINI_LM_MODEL: ModelDefinition = {
  assetPackName: 'all-mini-lm',
  assetFiles: {
    modelSource: require('../assets/models/all-mini-lm/all-MiniLM-L6-v2_xnnpack.pte'),
    tokenizerSource: require('../assets/models/all-mini-lm/tokenizer.json'),
  },
  assetPackFiles: {
    modelSource: 'all-MiniLM-L6-v2_xnnpack.pte',
    tokenizerSource: 'tokenizer.json',
  },
};

export function getModelSourceStrategy(): ModelSourceStrategy {
  if (Platform.OS === 'ios') {
    return ModelSourceStrategy.BUNDLED_ASSETS;
  }

  if (Platform.OS === 'android') {
    return __DEV__
      ? ModelSourceStrategy.BUNDLED_ASSETS
      : ModelSourceStrategy.ASSET_PACK_COPY;
  }

  return ModelSourceStrategy.BUNDLED_ASSETS;
}

export async function getModelConfig(
  modelDef: ModelDefinition
): Promise<ModelSourceConfig> {
  const strategy = getModelSourceStrategy();

  switch (strategy) {
    case ModelSourceStrategy.BUNDLED_ASSETS:
      return getBundledAssetConfig(modelDef);

    case ModelSourceStrategy.ASSET_PACK_COPY:
      return getAssetPackConfig(modelDef);

    default:
      throw new Error(`Unsupported model source strategy: ${strategy}`);
  }
}

function getBundledAssetConfig(modelDef: ModelDefinition): ModelSourceConfig {
  const config: ModelSourceConfig = {
    tokenizerSource: modelDef.assetFiles.tokenizerSource,
  };

  if (modelDef.assetFiles.decoderSource) {
    config.decoderSource = modelDef.assetFiles.decoderSource;
  }

  if (modelDef.assetFiles.encoderSource) {
    config.encoderSource = modelDef.assetFiles.encoderSource;
  }

  if (modelDef.assetFiles.modelSource) {
    config.modelSource = modelDef.assetFiles.modelSource;
  }

  return config;
}

async function getAssetPackConfig(
  modelDef: ModelDefinition
): Promise<ModelSourceConfig> {
  const modelDir = `${DocumentDirectoryPath}/${modelDef.assetPackName}_models`;

  const filePaths: Record<string, string> = {};
  const existsPromises: Array<Promise<boolean>> = [];

  Object.entries(modelDef.assetPackFiles).forEach(([key, filename]) => {
    if (filename) {
      filePaths[key] = `${modelDir}/${filename}`;
      existsPromises.push(exists(filePaths[key]));
    }
  });

  const filesExist = await Promise.all(existsPromises);
  const allFilesExist = filesExist.every(Boolean);
  if (!allFilesExist) {
    await copyFileAssets(modelDef.assetPackName, modelDir);
  }

  const config: ModelSourceConfig = {
    tokenizerSource: `file://${filePaths.tokenizerSource}`,
  };

  if (filePaths.decoderSource) {
    config.decoderSource = `file://${filePaths.decoderSource}`;
  }

  if (filePaths.encoderSource) {
    config.encoderSource = `file://${filePaths.encoderSource}`;
  }

  if (filePaths.modelSource) {
    config.modelSource = `file://${filePaths.modelSource}`;
  }

  return config;
}
