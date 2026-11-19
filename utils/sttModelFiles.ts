import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import { Platform } from 'react-native';
import { models, type WhisperSttModel } from 'react-native-executorch';
import { ResourceFetcher } from 'react-native-executorch/legacy';
import { cancelFetchingSources } from './cancelFetching';
import { ensureStorageFor } from './storageSpace';
import { toLocalPath } from './localPath';

const WHISPER_TINY_EN_COREML_BYTES = 76_477_024;
const WHISPER_TINY_EN_XNNPACK_BYTES = 232_606_208;
const WHISPER_TINY_EN_TOKENIZER_BYTES = 2_405_679;
const FSMN_VAD_BYTES = 1_827_808;

export const WHISPER_DOWNLOAD_SIZE_BYTES =
  (Platform.OS === 'ios'
    ? WHISPER_TINY_EN_COREML_BYTES
    : WHISPER_TINY_EN_XNNPACK_BYTES) +
  WHISPER_TINY_EN_TOKENIZER_BYTES +
  FSMN_VAD_BYTES;

const TINY_ENGLISH_WHISPER = models.speechToText.WHISPER.EN.TINY;

export const whisperModel = (): WhisperSttModel<'en'> =>
  Platform.OS === 'ios'
    ? TINY_ENGLISH_WHISPER.COREML_FP16
    : TINY_ENGLISH_WHISPER.XNNPACK_FP32;

export const whisperSources = (): string[] => {
  const model = whisperModel();
  return [model.modelPath, model.tokenizerPath, model.vadModel.modelPath];
};

const filenameOf = (source: string): string =>
  source.split('?')[0].split('/').pop() ?? source;

export const isWhisperDownloaded = async (): Promise<boolean> => {
  const filenames = whisperSources().map(filenameOf);
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
  if (!(await isWhisperDownloaded())) {
    ensureStorageFor(WHISPER_DOWNLOAD_SIZE_BYTES);
  }
  const paths = await ResourceFetcher.fetch(onProgress, ...whisperSources());
  return paths !== null;
};

export const localWhisperModel = async (
  onProgress: (progress: number) => void
): Promise<WhisperSttModel<'en'>> => {
  const model = whisperModel();
  const paths = await ResourceFetcher.fetch(onProgress, ...whisperSources());
  if (!paths || paths.length < 3) {
    throw new Error('The dictation model download did not finish.');
  }
  const [modelPath, tokenizerPath, vadPath] = paths.map(toLocalPath);
  return {
    ...model,
    modelPath,
    tokenizerPath,
    vadModel: { ...model.vadModel, modelPath: vadPath },
  };
};

export const cancelWhisperFetch = (isStillFetching: () => boolean) =>
  cancelFetchingSources(whisperSources(), isStillFetching);
