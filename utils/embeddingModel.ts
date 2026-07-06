import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
import {
  LFM_2_5_EMBEDDING_DOWNLOAD_SIZE_BYTES,
  LFM_2_5_EMBEDDING_MODEL_FILE,
} from '../constants/embedding-model';

export const isEmbeddingModelDownloaded = async (): Promise<boolean> => {
  try {
    const files = await ExpoResourceFetcher.listDownloadedFiles();
    return files.some((file) => file.endsWith(LFM_2_5_EMBEDDING_MODEL_FILE));
  } catch (error) {
    console.warn('Failed to check embedding model download status', error);
    return false;
  }
};

export const embeddingModelDownloadSizeLabel = (): string => {
  const megabytes = LFM_2_5_EMBEDDING_DOWNLOAD_SIZE_BYTES / (1024 * 1024);
  return `${Math.round(megabytes)} MB`;
};
