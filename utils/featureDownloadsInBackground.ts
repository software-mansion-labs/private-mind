import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import { LFM_2_5_EMBEDDING_SOURCES } from '../constants/embedding-model';
import { whisperSources } from './sttModelFiles';

const embeddingSources = (): string[] =>
  [
    LFM_2_5_EMBEDDING_SOURCES.modelSource,
    LFM_2_5_EMBEDDING_SOURCES.tokenizerSource,
  ].filter((source): source is string => typeof source === 'string');

const featureSourceGroups = () => [embeddingSources(), whisperSources()];

const pausedGroups: string[][] = [];

let pending: Promise<void> = Promise.resolve();

export const pauseFeatureDownloadsForBackground = () => {
  pending = pending.then(async () => {
    for (const group of featureSourceGroups()) {
      if (group.length === 0) continue;
      const paused = await ExpoResourceFetcher.pauseFetching(...group).then(
        () => true,
        () => false
      );
      if (paused) pausedGroups.push(group);
    }
  });
  return pending;
};

export const resumeFeatureDownloadsAfterBackground = () => {
  pending = pending.then(() => {
    for (const group of pausedGroups.splice(0)) {
      ExpoResourceFetcher.resumeFetching(...group).catch((error) =>
        console.error('Failed to resume a feature download', error)
      );
    }
  });
  return pending;
};
