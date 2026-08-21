import { useMemo } from 'react';
import { type SourceDocument } from '../database/chatRepository';
import { sourceKey } from '../utils/contextUtils';

export const useMessageSources = (sourceDocuments?: SourceDocument[]) => {
  const deduped = useMemo(() => {
    if (!sourceDocuments?.length) return [];

    const seen = new Set<string>();
    return sourceDocuments.filter((source) => {
      const key =
        source.kind === 'web' && source.url
          ? `web:${source.url}`
          : sourceKey(source.documentId, source.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [sourceDocuments]);

  const displayedSources = useMemo(
    () =>
      deduped.filter(
        (source) =>
          source.kind !== 'web' || source.read !== false || source.used === true
      ),
    [deduped]
  );

  const webResults = useMemo(
    () => deduped.filter((source) => source.kind === 'web'),
    [deduped]
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
