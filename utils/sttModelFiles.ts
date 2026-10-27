import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import { WHISPER_TINY_EN } from 'react-native-executorch/legacy';

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
