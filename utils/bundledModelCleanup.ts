import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';

const CLEANUP_DONE_KEY = 'bundled_model_leftovers_removed';

const LEFTOVER_MINILM_MODEL_NAME_PART = 'all-MiniLM-L6-v2';
const LEFTOVER_MINILM_MODEL_BYTES = 90992000;
const LEFTOVER_MINILM_TOKENIZER_FILE = '3037831014.json';

const isLeftover = (file: File) => {
  const fileName = fileNameOf(file.uri);
  if (fileName === LEFTOVER_MINILM_TOKENIZER_FILE) return true;
  if (fileName.includes(LEFTOVER_MINILM_MODEL_NAME_PART)) return true;
  if (!fileName.endsWith('.pte')) return false;
  try {
    return file.size === LEFTOVER_MINILM_MODEL_BYTES;
  } catch {
    return false;
  }
};

const fileNameOf = (uri: string) => {
  const lastSegment = uri.split('/').pop() ?? '';
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
};

export const removeBundledModelLeftovers = async (): Promise<number> => {
  if ((await AsyncStorage.getItem(CLEANUP_DONE_KEY)) === 'true') return 0;

  let removed = 0;
  try {
    const uris = await ExpoResourceFetcher.listDownloadedFiles();
    for (const uri of uris) {
      const file = new File(uri);
      if (!isLeftover(file)) continue;
      try {
        file.delete();
        removed += 1;
      } catch (error) {
        console.warn('Failed to remove leftover model file', uri, error);
      }
    }
  } catch {
    return 0;
  }

  await AsyncStorage.setItem(CLEANUP_DONE_KEY, 'true');
  return removed;
};
