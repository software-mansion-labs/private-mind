import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import { Platform } from 'react-native';
import { models, type WhisperSttModel } from 'react-native-executorch';
import { ResourceFetcher } from 'react-native-executorch/legacy';
import { cancelFetchingSources } from './cancelFetching';
import { ensureStorageFor } from './storageSpace';
import { toLocalPath } from './localPath';
import type { SttModelKind } from './dictationLanguage';

export type { SttModelKind };

export const STT_MODEL_KINDS: readonly SttModelKind[] = [
  'english',
  'multilingual',
];

const WHISPER_TINY_EN_COREML_BYTES = 76_477_024;
const WHISPER_TINY_EN_XNNPACK_BYTES = 232_606_208;
const WHISPER_TINY_EN_TOKENIZER_BYTES = 2_405_679;
const WHISPER_TINY_COREML_BYTES = 76_477_794;
const WHISPER_TINY_XNNPACK_BYTES = 232_609_280;
const WHISPER_TINY_TOKENIZER_BYTES = 2_480_466;
const FSMN_VAD_BYTES = 1_827_808;
const BYTES_PER_MB = 1_000_000;

const isIOS = () => Platform.OS === 'ios';

const MODEL_BYTES: Record<SttModelKind, () => number> = {
  english: () =>
    (isIOS() ? WHISPER_TINY_EN_COREML_BYTES : WHISPER_TINY_EN_XNNPACK_BYTES) +
    WHISPER_TINY_EN_TOKENIZER_BYTES,
  multilingual: () =>
    (isIOS() ? WHISPER_TINY_COREML_BYTES : WHISPER_TINY_XNNPACK_BYTES) +
    WHISPER_TINY_TOKENIZER_BYTES,
};

export const whisperDownloadSizeBytes = (kind: SttModelKind): number =>
  MODEL_BYTES[kind]() + FSMN_VAD_BYTES;

export const whisperDownloadSizeLabel = (kind: SttModelKind): string =>
  `${Math.round(whisperDownloadSizeBytes(kind) / BYTES_PER_MB)} MB`;

const WHISPER_VARIANTS: Record<SttModelKind, () => WhisperSttModel> = {
  english: () => {
    const tiny = models.speechToText.WHISPER.EN.TINY;
    return isIOS() ? tiny.COREML_FP16 : tiny.XNNPACK_FP32;
  },
  multilingual: () => {
    const tiny = models.speechToText.WHISPER.TINY;
    return isIOS() ? tiny.COREML_FP16 : tiny.XNNPACK_FP32;
  },
};

export const whisperModel = (kind: SttModelKind): WhisperSttModel =>
  WHISPER_VARIANTS[kind]();

export const whisperSources = (kind: SttModelKind): string[] => {
  const model = whisperModel(kind);
  return [model.modelPath, model.tokenizerPath, model.vadModel.modelPath];
};

const otherKind = (kind: SttModelKind): SttModelKind =>
  kind === 'english' ? 'multilingual' : 'english';

export const downloadedFilenameOf = (source: string): string =>
  (source.replace(/^https?:\/\//, '').split('#')[0] ?? source).replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  );

const allOnDisk = (sources: string[], files: string[]) =>
  sources
    .map(downloadedFilenameOf)
    .every((name) => files.some((file) => file.endsWith(name)));

export const isWhisperDownloaded = async (
  kind: SttModelKind
): Promise<boolean> => {
  try {
    const files = await ExpoResourceFetcher.listDownloadedFiles();
    return allOnDisk(whisperSources(kind), files);
  } catch {
    return false;
  }
};

export const fetchWhisperFiles = async (
  kind: SttModelKind,
  onProgress: (progress: number) => void
): Promise<boolean> => {
  if (!(await isWhisperDownloaded(kind))) {
    ensureStorageFor(whisperDownloadSizeBytes(kind));
  }
  const paths = await ResourceFetcher.fetch(
    onProgress,
    ...whisperSources(kind)
  );
  return paths !== null;
};

export const localWhisperModel = async (
  kind: SttModelKind,
  onProgress: (progress: number) => void
): Promise<WhisperSttModel> => {
  const model = whisperModel(kind);
  const paths = await ResourceFetcher.fetch(
    onProgress,
    ...whisperSources(kind)
  );
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

export const cancelWhisperFetch = (
  kind: SttModelKind,
  isStillFetching: () => boolean
) => cancelFetchingSources(whisperSources(kind), isStillFetching);

export const deleteWhisperFiles = async (kind: SttModelKind): Promise<void> => {
  const [modelPath, tokenizerPath, vadPath] = whisperSources(kind);
  const sharedVadStillNeeded = await isWhisperDownloaded(otherKind(kind));
  const doomed = sharedVadStillNeeded
    ? [modelPath, tokenizerPath]
    : [modelPath, tokenizerPath, vadPath];
  await ExpoResourceFetcher.deleteResources(...doomed);
};
