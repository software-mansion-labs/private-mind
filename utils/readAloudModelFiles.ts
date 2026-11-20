import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import {
  models,
  type ReverbDefaultVoiceName,
  type ReverbTtsModel,
} from 'react-native-executorch';
import { ResourceFetcher } from 'react-native-executorch/legacy';
import { cancelFetchingSources } from './cancelFetching';
import { ensureStorageFor } from './storageSpace';
import { toLocalPath } from './localPath';

const MEGABYTE = 1_000_000;
const UNKNOWN_BACKBONE_BYTES = 410 * MEGABYTE;
const CODEC_DECODER_BYTES = 84 * MEGABYTE;
const SMALL_FILES_BYTES = 2 * MEGABYTE;

const BACKBONE_BYTES_BY_FILE: Record<string, number> = {
  'reverb_mlx_int8.pte': 352 * MEGABYTE,
  'reverb_mlx_fp16.pte': 612 * MEGABYTE,
  'reverb_mlx_int4.pte': 232 * MEGABYTE,
  'reverb_vulkan_int4.pte': 233 * MEGABYTE,
  'reverb_xnnpack_8da8w.pte': 326 * MEGABYTE,
};

const FILE_COUNT = 4;

const remoteModel = (): ReverbTtsModel<ReverbDefaultVoiceName> =>
  models.textToSpeech.REVERB.DEFAULT;

const lastSegment = (source: string): string =>
  source.split('?')[0]!.split('/').pop() ?? source;

export const fileNameOnDisk = (source: string): string =>
  source.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9._-]/g, '_');

export const readAloudSources = (voice: ReverbDefaultVoiceName): string[] => {
  const { modelPaths, tokenizerPath, voices } = remoteModel();
  return [
    modelPaths.backbone,
    modelPaths.codecDecoder,
    tokenizerPath,
    voices![voice],
  ];
};

export const readAloudDownloadBytes = (): number => {
  const backbone = lastSegment(remoteModel().modelPaths.backbone);
  return (
    (BACKBONE_BYTES_BY_FILE[backbone] ?? UNKNOWN_BACKBONE_BYTES) +
    CODEC_DECODER_BYTES +
    SMALL_FILES_BYTES
  );
};

export const isReadAloudDownloaded = async (
  voice: ReverbDefaultVoiceName
): Promise<boolean> => {
  try {
    const files = await ExpoResourceFetcher.listDownloadedFiles();
    return readAloudSources(voice).every((source) =>
      files.some((file) => file.endsWith(fileNameOnDisk(source)))
    );
  } catch {
    return false;
  }
};

export const localReadAloudModel = async (
  voice: ReverbDefaultVoiceName,
  onProgress: (progress: number) => void
): Promise<ReverbTtsModel<ReverbDefaultVoiceName>> => {
  if (!(await isReadAloudDownloaded(voice))) {
    ensureStorageFor(readAloudDownloadBytes());
  }
  const paths = await ResourceFetcher.fetch(
    onProgress,
    ...readAloudSources(voice)
  );
  if (!paths || paths.length < FILE_COUNT) {
    throw new Error('The read-aloud model download did not finish.');
  }
  const [backbone, codecDecoder, tokenizerPath, voicePath] =
    paths.map(toLocalPath);
  return {
    name: 'reverb',
    modelPaths: { backbone: backbone!, codecDecoder: codecDecoder! },
    tokenizerPath: tokenizerPath!,
    voices: { [voice]: voicePath! } as Record<ReverbDefaultVoiceName, string>,
  };
};

export const cancelReadAloudFetch = (
  voice: ReverbDefaultVoiceName,
  isStillFetching: () => boolean
) => cancelFetchingSources(readAloudSources(voice), isStillFetching);
