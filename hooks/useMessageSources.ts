import { useMemo } from 'react';
import { type SourceDocument } from '../database/chatRepository';
import { sourceKey } from '../utils/contextUtils';

export const useMessageSources = (sourceDocuments?: SourceDocument[]) => {
  const displayedSources = useMemo(() => {
    if (!sourceDocuments?.length) return [];

    const seen = new Set<string>();
    return sourceDocuments.filter((source) => {
      const key = sourceKey(source.documentId, source.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [sourceDocuments]);

  const webResults = useMemo(
    () => displayedSources.filter((source) => source.kind === 'web'),
    [displayedSources]
  );

  const documentSources = useMemo(
    () =>
      displayedSources.filter((source) => source.kind !== 'web' || source.used),
    [displayedSources]
  );

  return {
    displayedSources,
    webResults,
    documentSources,
    hasSources: displayedSources.length > 0,
  };
};
