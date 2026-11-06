import { File, Paths } from 'expo-file-system';
import { ResourceFetcherUtils } from 'react-native-executorch/legacy';

const REMOTE_SOURCE = /^https?:\/\//;

export const downloadsDirectoryUri = () =>
  `${Paths.document.uri}react-native-executorch/`;

export const downloadedCopyUri = (url: string) =>
  `${downloadsDirectoryUri()}${ResourceFetcherUtils.getFilenameFromUri(url)}`;

const fileExists = (uri: string) => {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
};

export const hasDownloadedCopy = (source: unknown) =>
  typeof source === 'string' &&
  REMOTE_SOURCE.test(source) &&
  fileExists(downloadedCopyUri(source));

export const preferDownloadedCopy = <Source>(
  source: Source
): Source | string =>
  hasDownloadedCopy(source) ? downloadedCopyUri(source as string) : source;
