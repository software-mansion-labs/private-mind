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
  buildCorrectiveEvidence,
  reformulateForCorrection,
  uncoveredTermsQuery,
  reformulateWithEvidence,
} from './reformulateQuery';
import { detectTopicLanguage, nativeTitleQuery } from './topicLanguage';
import {
  analyzeSourceAgreement,
  type SourceAgreement,
} from './sourceAgreement';
import { hostname, webResultsToContext } from './webResultsToContext';
import { dedupeByBody, listingFingerprint } from './fingerprint';
import { interleaveByRound } from './mergeRounds';
import { rankByListingRelevance } from './listingRelevance';
import { promoteTitleConsensus } from './titleConsensus';
import { pageCache, serpCache } from './cache/webCache';
import { extractArticle } from './url/extractArticle';
import {
  WEB_ADAPTIVE_ENRICH,
  WEB_AGREEMENT_ENABLED,
  WEB_CORRECTIVE_ENABLED,
  WEB_CORRECTIVE_LLM_REWRITE,
  WEB_CORRECTIVE_MERGED_MAX_RESULTS,
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
  correctiveFired: boolean;
  correctiveQuery?: string;
  correctiveSource?: 'coverage' | 'evidence' | 'native-title' | 'heuristic';
  correctiveLanguage?: string;
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
    correctiveFired: false,
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
  const round1Results = await runQueries(baseQueries, 1, seen);
  const round1 = await groundAndEvaluate(round1Results, WEB_SEARCH_MAX_RESULTS);

  let finalResults = round1.grounded;
  let evaluation = round1.evaluation;
  let agreement = round1.agreement;
  telemetry.rounds.push({
    round: 1,
    queries: baseQueries,
    resultCount: round1Results.length,
    contentCount: round1.contentCount,
    confidence: round1.evaluation.confidence,
    label: round1.evaluation.label,
    enrichedPages: round1.enrichedPages,
    enrichWaves: round1.waves,
    independentHosts: round1.agreement.independentHosts,
    corroboratedClaims: round1.agreement.corroborated.length,
  });

  const shouldRunCorrectiveRound =
    WEB_CORRECTIVE_ENABLED && evaluation.shouldCorrect && !signal?.aborted;

  if (shouldRunCorrectiveRound) {
    const topicLanguage = detectTopicLanguage(round1.grounded);
    telemetry.correctiveLanguage = topicLanguage?.name ?? 'English';

    let reformulated = '';
    if (WEB_CORRECTIVE_LLM_REWRITE) {
      reformulated = await reformulateWithEvidence({
        query,
        alreadyRun: baseQueries,
        evidence: buildCorrectiveEvidence(round1.grounded),
        generate,
        targetLanguage: telemetry.correctiveLanguage,
      });
      if (reformulated) telemetry.correctiveSource = 'evidence';
    }
    if (!reformulated && topicLanguage) {
      const native = nativeTitleQuery(round1.grounded, topicLanguage);
      if (native && !baseQueries.includes(native)) {
        reformulated = native;
        telemetry.correctiveSource = 'native-title';
      }
    }
    if (!reformulated) {
      reformulated = uncoveredTermsQuery(query, round1.grounded, baseQueries);
      if (reformulated) telemetry.correctiveSource = 'coverage';
    }
    if (!reformulated) {
      reformulated = reformulateForCorrection(query, plan, baseQueries);
      if (reformulated) telemetry.correctiveSource = 'heuristic';
    }
    if (reformulated) {
      const round2Results = await runQueries([reformulated], 2, seen);
      const merged = interleaveByRound(round1Results, round2Results).map(
        (result) => enrichedByUrl.get(result.url) ?? result
      );
      const corrective = await groundAndEvaluate(
        merged,
        WEB_CORRECTIVE_MERGED_MAX_RESULTS
      );
      finalResults = corrective.grounded;
      evaluation = corrective.evaluation;
      agreement = corrective.agreement;
      telemetry.correctiveFired = true;
      telemetry.correctiveQuery = reformulated;
      telemetry.rounds.push({
        round: 2,
        queries: [reformulated],
        resultCount: round2Results.length,
        contentCount: corrective.contentCount,
        confidence: corrective.evaluation.confidence,
        label: corrective.evaluation.label,
        enrichedPages: corrective.enrichedPages,
        enrichWaves: corrective.waves,
        independentHosts: corrective.agreement.independentHosts,
        corroboratedClaims: corrective.agreement.corroborated.length,
      });
    }
  }

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

  const usedQueries = telemetry.correctiveFired
    ? [...baseQueries, telemetry.correctiveQuery!]
    : baseQueries;
  const label =
    usedQueries.length > 1 ? usedQueries.join(' + ') : usedQueries[0];
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
