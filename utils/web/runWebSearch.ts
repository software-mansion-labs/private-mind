import type { LFMEmbeddings } from '../lfmEmbeddings';
import type {
  WebSearchProvider,
  WebSearchResult,
  WebSourceDocument,
} from './types';
import { planWebSearch, type QueryRewriteFn } from './buildSearchQuery';
import type { ModelProfile } from '../../constants/model-profiles';
import {
  enrichWebResults,
  type ArticleFetcher,
  type EnrichPageEvent,
} from './enrichResults';
import {
  createWebEmbeddingCache,
  retrieveWebPassages,
  type WebRetrievalQuery,
} from './transientRetrieval';
import {
  evaluateWebRetrieval,
  type RetrievalEvaluation,
  type RetrievalLabel,
  type WebRetrievalSignals,
} from './retrievalEvaluator';
import {
  analyzeSourceAgreement,
  type SourceAgreement,
} from './sourceAgreement';
import { hostname, webResultsToContext } from './webResultsToContext';
import { dedupeByBody, listingFingerprint } from './fingerprint';
import { rankByListingRelevance } from './listingRelevance';
import { promoteTitleConsensus } from './titleConsensus';
import { pageCache, serpCache } from './cache/webCache';
import { extractArticle } from './url/extractArticle';
import {
  WEB_ADAPTIVE_ENRICH,
  WEB_AGREEMENT_ENABLED,
  WEB_ENRICH_WAVE_FIRST,
  WEB_ENRICH_WAVE_STEP,
  WEB_FETCH_TOP_N_CONTENT,
  WEB_QUERY_GATE,
  WEB_RETRIEVAL_FETCH_TOP_N,
  WEB_SEARCH_MAX_RESULTS,
} from '../../constants/web';

export interface WebSearchProgressEvent {
  type:
    | 'objectives'
    | 'searching'
    | 'found'
    | 'reading'
    | 'fetched'
    | 'failed'
    | 'ranking'
    | 'done'
    | 'weak'
    | 'offline'
    | 'skipped'
    | 'timeout';
  query?: string;
  host?: string;
  url?: string;
  title?: string;
  round?: number;
}

export interface RunWebSearchInput {
  query: string;
  history: { role: string; content: string }[];
  provider: WebSearchProvider;
  embeddings: LFMEmbeddings | null;
  embeddingModelReady: boolean;
  generate: QueryRewriteFn;
  onProgress?: (event: WebSearchProgressEvent) => void;
  signal?: AbortSignal;
  today?: string;
  profile?: ModelProfile;
  contextOffset?: number;
  contextCharBudget?: number;
  isOnline?: () => Promise<boolean>;
  isolateEmbeddings?: <T>(operation: () => Promise<T>) => Promise<T>;
  lowMemory?: boolean;
  fetchArticle?: ArticleFetcher;
  useCache?: boolean;
}

export interface WebRoundTelemetry {
  round: number;
  queries: string[];
  resultCount: number;
  contentCount: number;
  confidence: number;
  label: RetrievalLabel;
  enrichedPages: number;
  enrichWaves: number;
  independentHosts: number;
  corroboratedClaims: number;
}

export interface WebSearchTelemetry {
  needsSearch: boolean;
  skippedReason?: 'gated' | 'provider-not-ready' | 'offline';
  plannedQueries: string[];
  rounds: WebRoundTelemetry[];
  providerCalls: number;
  enginesTried: string[];
  finalConfidence: number;
  finalLabel: RetrievalLabel;
  agreement: SourceAgreement;
}

export interface RunWebSearchResult {
  context: string[];
  sourceDocuments: WebSourceDocument[];
  telemetry: WebSearchTelemetry;
}

const contentCountOf = (results: WebSearchResult[]): number =>
  results.filter((result) => result.content?.trim()).length;

const NO_AGREEMENT: SourceAgreement = {
  independentHosts: 0,
  repeatedHostResults: 0,
  corroborated: [],
  singleSourced: [],
  agreementRatio: 0,
};

export const runWebSearch = async (
  input: RunWebSearchInput
): Promise<RunWebSearchResult> => {
  const {
    query,
    history,
    provider,
    embeddings,
    embeddingModelReady,
    generate,
    onProgress,
    signal,
  } = input;
  const emit = (event: WebSearchProgressEvent): void => onProgress?.(event);
  const useEmbeddings =
    !!embeddings &&
    embeddingModelReady &&
    !input.lowMemory &&
    (input.profile?.webEmbeddingRetrieval ?? true);

  let providerCalls = 0;
  const attempted = new Set<string>();
  const enrichedByUrl = new Map<string, WebSearchResult>();

  const useCache = input.useCache ?? false;
  const baseFetchArticle = input.fetchArticle ?? extractArticle;
  const fetchArticle: ArticleFetcher = useCache
    ? async (url, timeoutMs, abort) => {
        const hit = pageCache.get(url);
        if (hit) return hit;
        const article = await baseFetchArticle(url, timeoutMs, abort);
        pageCache.set(url, article, article.text.length);
        return article;
      }
    : baseFetchArticle;

  const telemetry: WebSearchTelemetry = {
    needsSearch: true,
    plannedQueries: [],
    rounds: [],
    providerCalls: 0,
    enginesTried: [],
    finalConfidence: 0,
    finalLabel: 'incorrect',
    agreement: NO_AGREEMENT,
  };
  const empty = (reason: WebSearchTelemetry['skippedReason']) => ({
    context: [] as string[],
    sourceDocuments: [] as WebSourceDocument[],
    telemetry: { ...telemetry, skippedReason: reason },
  });

  if (input.isOnline && !(await input.isOnline())) {
    emit({ type: 'offline' });
    return empty('offline');
  }

  emit({ type: 'objectives' });

  const plan = await planWebSearch(query, history, generate, {
    ...(input.today ? { today: input.today } : {}),
    ...(input.profile ? { rewrite: input.profile.webPlanner === 'llm' } : {}),
  });
  const baseQueries = plan.queries.length ? plan.queries : [query];
  telemetry.needsSearch = plan.needsSearch;
  telemetry.plannedQueries = baseQueries;
  const shouldSearch = WEB_QUERY_GATE
    ? plan.needsSearch && plan.queries.length > 0
    : true;

  if (!shouldSearch) {
    emit({ type: 'skipped' });
    return empty('gated');
  }
  if (provider.isReady && !provider.isReady()) {
    console.warn('Web search skipped: provider not ready');
    return empty('provider-not-ready');
  }

  const runQueries = async (
    queries: string[],
    round: number,
    seen: Set<string>
  ): Promise<WebSearchResult[]> => {
    const out: WebSearchResult[] = [];
    for (const q of queries) {
      if (signal?.aborted) break;
      emit({ type: 'searching', query: q, round });
      try {
        const cached = useCache ? serpCache.get(q) : undefined;
        let found: WebSearchResult[];
        if (cached) {
          found = cached;
        } else {
          providerCalls += 1;
          found = await provider.search(q, {
            ...(signal ? { signal } : {}),
            onEngine: (engine) => {
              if (!telemetry.enginesTried.includes(engine.id)) {
                telemetry.enginesTried.push(engine.id);
              }
            },
          });
          if (useCache && found.length > 0) serpCache.set(q, found);
        }
        for (const item of found) {
          if (!item.url) continue;
          const listing = listingFingerprint(item);
          const keys = [`u:${item.url}`, ...(listing ? [`l:${listing}`] : [])];
          if (keys.some((key) => seen.has(key))) continue;
          keys.forEach((key) => seen.add(key));
          out.push(item);
          emit({
            type: 'found',
            url: item.url,
            host: hostname(item.url),
            ...(item.title ? { title: item.title } : {}),
            round,
          });
        }
      } catch (error) {
        console.warn('Web query failed', q, error);
      }
    }
    return out;
  };

  const maxEnrich = useEmbeddings
    ? WEB_RETRIEVAL_FETCH_TOP_N
    : (input.profile?.webFetchTopNContent ?? WEB_FETCH_TOP_N_CONTENT);
  const embeddingCache = createWebEmbeddingCache();

  const onPage = (page: EnrichPageEvent): void => {
    attempted.add(page.url);
    emit({
      type: page.ok ? 'fetched' : 'failed',
      host: page.host,
      url: page.url,
    });
  };

  const score = async (
    enriched: WebSearchResult[],
    resultCount: number
  ): Promise<{
    grounded: WebSearchResult[];
    evaluation: RetrievalEvaluation;
    contentCount: number;
    agreement: SourceAgreement;
  }> => {
    let grounded = enriched;
    let signals: WebRetrievalSignals | null = null;
    emit({ type: 'ranking' });
    if (useEmbeddings) {
      const retrievalQuery: WebRetrievalQuery = {
        semanticQuery: query,
        keywordQuery: baseQueries.join(' '),
      };
      const runRetrieval = () =>
        embeddings!.runWithLoadedModel(() =>
          retrieveWebPassages(
            enriched,
            retrievalQuery,
            embeddings!,
            embeddingCache,
            signal,
            input.profile?.webRetrievalTopK
          )
        );
      const retrieval = await (input.isolateEmbeddings
        ? input.isolateEmbeddings(runRetrieval)
        : runRetrieval());
      grounded = retrieval.results;
      signals = retrieval.signals;
    }

    const contentCount = contentCountOf(grounded);
    const agreement = WEB_AGREEMENT_ENABLED
      ? analyzeSourceAgreement(grounded)
      : NO_AGREEMENT;
    const evaluation = evaluateWebRetrieval({
      resultCount,
      contentCount,
      retrieval: signals,
      agreement: WEB_AGREEMENT_ENABLED ? agreement : null,
    });
    return { grounded, evaluation, contentCount, agreement };
  };

  const groundAndEvaluate = async (
    merged: WebSearchResult[],
    cap: number
  ): Promise<{
    grounded: WebSearchResult[];
    evaluation: RetrievalEvaluation;
    contentCount: number;
    agreement: SourceAgreement;
    enrichedPages: number;
    waves: number;
  }> => {
    const capped = rankByListingRelevance(merged, query).slice(0, cap);
    let enriched = capped;
    let target = WEB_ADAPTIVE_ENRICH
      ? Math.min(Math.max(1, WEB_ENRICH_WAVE_FIRST), maxEnrich)
      : maxEnrich;
    let waves = 0;
    let spent = 0;

    const runWave = async () => {
      emit({ type: 'reading' });
      let readThisWave = 0;
      enriched = dedupeByBody(
        await enrichWebResults(
          enriched,
          Math.max(0, target - spent),
          (page) => {
            if (page.ok) readThisWave += 1;
            onPage(page);
          },
          attempted,
          fetchArticle,
          signal,
          input.lowMemory
        )
      );
      spent += readThisWave;
      for (const result of enriched) {
        if (result.content?.trim()) enrichedByUrl.set(result.url, result);
      }
      waves += 1;
      return score(enriched, capped.length);
    };

    const hasUntriedPageInReach = (): boolean =>
      enriched.some(
        (result) => !result.content?.trim() && !attempted.has(result.url)
      );

    let outcome = await runWave();
    const shouldWiden = (): boolean =>
      WEB_ADAPTIVE_ENRICH &&
      outcome.evaluation.shouldCorrect &&
      target < maxEnrich &&
      !signal?.aborted &&
      hasUntriedPageInReach();

    while (shouldWiden()) {
      target = Math.min(target + WEB_ENRICH_WAVE_STEP, maxEnrich);
      outcome = await runWave();
    }
    return { ...outcome, enrichedPages: target, waves };
  };

  const seen = new Set<string>();
  const found = await runQueries(baseQueries, 1, seen);
  const outcome = await groundAndEvaluate(found, WEB_SEARCH_MAX_RESULTS);

  let finalResults = outcome.grounded;
  const { evaluation, agreement } = outcome;
  telemetry.rounds.push({
    round: 1,
    queries: baseQueries,
    resultCount: found.length,
    contentCount: outcome.contentCount,
    confidence: outcome.evaluation.confidence,
    label: outcome.evaluation.label,
    enrichedPages: outcome.enrichedPages,
    enrichWaves: outcome.waves,
    independentHosts: outcome.agreement.independentHosts,
    corroboratedClaims: outcome.agreement.corroborated.length,
  });

  finalResults = promoteTitleConsensus(finalResults, query);

  if (evaluation.shouldCorrect && finalResults.length > 0) {
    emit({ type: 'weak' });
  }
  emit({ type: 'done' });
  telemetry.providerCalls = providerCalls;
  telemetry.finalConfidence = evaluation.confidence;
  telemetry.finalLabel = evaluation.label;
  telemetry.agreement = agreement;

  if (finalResults.length === 0) {
    return { context: [], sourceDocuments: [], telemetry };
  }

  const label =
    baseQueries.length > 1 ? baseQueries.join(' + ') : baseQueries[0];
  const web = webResultsToContext(
    finalResults,
    label,
    input.contextOffset ?? 0,
    input.contextCharBudget
  );
  return {
    context: web.context,
    sourceDocuments: web.sourceDocuments,
    telemetry,
  };
};
