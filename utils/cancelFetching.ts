import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';

export const cancelFetchingSources = async (sources: readonly string[]) => {
  await Promise.all(
    sources.map((source) =>
      Promise.resolve()
        .then(() => ExpoResourceFetcher.cancelFetching(source))
        .catch(() => undefined)
    )
  );
};
