import { ensureStorageFor } from './storageSpace';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import { Platform } from 'react-native';
import {
  ResourceFetcher,
  WHISPER_TINY_EN,
} from 'react-native-executorch/legacy';
import { cancelFetchingSources } from './cancelFetching';

const WHISPER_TINY_EN_COREML_BYTES = 76_477_024;
const WHISPER_TINY_EN_XNNPACK_BYTES = 232_606_208;
const WHISPER_TINY_EN_TOKENIZER_BYTES = 2_405_679;

export const WHISPER_DOWNLOAD_SIZE_BYTES =
  (Platform.OS === 'ios'
    ? WHISPER_TINY_EN_COREML_BYTES
    : WHISPER_TINY_EN_XNNPACK_BYTES) + WHISPER_TINY_EN_TOKENIZER_BYTES;

const remoteSources = (): string[] =>
  typeof WHISPER_TINY_EN === 'object' && WHISPER_TINY_EN !== null
    ? [WHISPER_TINY_EN.modelSource, WHISPER_TINY_EN.tokenizerSource].filter(
        (source) => typeof source === 'string' && source.startsWith('http')
      )
    : [];

const filenameOf = (source: string): string =>
  source.split('?')[0].split('/').pop() ?? source;

export const isWhisperDownloaded = async (): Promise<boolean> => {
  const filenames = remoteSources().map(filenameOf);
  if (filenames.length === 0) return false;
  try {
    const files = await ExpoResourceFetcher.listDownloadedFiles();
    return filenames.every((name) => files.some((file) => file.endsWith(name)));
  } catch {
    return false;
  }
};

export const fetchWhisperFiles = async (
  onProgress: (progress: number) => void
): Promise<boolean> => {
  const sources = remoteSources();
  if (sources.length === 0) return false;
  if (!(await isWhisperDownloaded())) {
    ensureStorageFor(WHISPER_DOWNLOAD_SIZE_BYTES);
  }
  const paths = await ResourceFetcher.fetch(onProgress, ...sources);
  return paths !== null;
};

export const cancelWhisperFetch = (isStillFetching: () => boolean) =>
  cancelFetchingSources(remoteSources(), isStillFetching);
