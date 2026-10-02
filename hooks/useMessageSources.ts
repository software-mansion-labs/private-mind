import { useMemo } from 'react';
import { type SourceDocument } from '../database/chatRepository';
import { sourceKey } from '../utils/contextUtils';
import { answerOverlapScorer } from '../utils/messageSources';

const keyOf = (source: SourceDocument) =>
  source.kind === 'web' && source.url
    ? `web:${source.url}`
    : sourceKey(source.documentId, source.name);

export const useMessageSources = (
  sourceDocuments?: SourceDocument[],
  answer?: string
) => {
  const deduped = useMemo(() => {
    if (!sourceDocuments?.length) return [];

    let scorer: ((passage: string) => number) | undefined;
    const score = (passage: string) => {
      scorer ??= answer ? answerOverlapScorer(answer) : () => 0;
      return scorer(passage);
    };
    const kept: SourceDocument[] = [];
    const positionByKey = new Map<string, number>();
    for (const source of sourceDocuments) {
      const key = keyOf(source);
      const position = positionByKey.get(key);
      if (position === undefined) {
        positionByKey.set(key, kept.length);
        kept.push(source);
        continue;
      }
      const answersBetter =
        source.kind !== 'web' &&
        score(source.passage ?? '') > score(kept[position]!.passage ?? '');
      if (answersBetter) kept[position] = source;
    }
    return kept;
  }, [sourceDocuments, answer]);

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

  const dominantWebSource = useMemo(() => {
    const used = webResults.filter((source) => source.used);
    return used.length === 1 ? used[0] : undefined;
  }, [webResults]);

  return {
    displayedSources,
    webResults,
    documentSources,
    dominantWebSource,
    hasSources: displayedSources.length > 0,
  };
};
