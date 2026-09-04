import type { LFMEmbeddings } from '../lfmEmbeddings';
import type {
  WebSearchProvider,
  WebSearchResult,
  WebSourceDocument,
} from './types';
import {
  isSmallTalk,
  planWebSearch,
  dedupeQueries,
  verbatimQueryFor,
  type QueryRewriteFn,
} from './buildSearchQuery';
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
import type { WebIntentKind } from './intentKind';
import { dedupeByBody, listingFingerprint } from './fingerprint';
import { fairRankByListingRelevance, scopeYearsOf } from './listingRelevance';
import { promoteTitleConsensus } from './titleConsensus';
import { promoteVerifiedProducts } from './promoteVerified';
import { pageCache, serpCache } from './cache/webCache';
import { extractArticle } from './url/extractArticle';
import type { FetchFailure, FetchFailureReason } from './fetchFailure';
import { isForeignScript } from './resultScript';
import { topKForBudget } from './retrievalBudget';
import { demoteUnaskedVariants } from './variantMatch';
import {
  planFetchRecovery,
  promotePrimarySources,
  type RecoveryStrategy,
} from './fetchRecovery';
import {
  WEB_ADAPTIVE_ENRICH,
  WEB_AGREEMENT_ENABLED,
  WEB_ENRICH_WAVE_FIRST,
  WEB_ENRICH_WAVE_STEP,
  WEB_FETCH_TOP_N_CONTENT,
  WEB_MIN_SAME_SCRIPT_RESULTS,
  WEB_VERBATIM_MIN_RESULTS,
  WEB_QUERY_GATE,
  WEB_RECOVERY_ENABLED,
  WEB_RECOVERY_MAX_RESULTS,
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
    | 'recovering'
    | 'timeout';
  query?: string;
  host?: string;
  url?: string;
  title?: string;
  round?: number;
  reason?: FetchFailureReason;
}

export interface RunWebSearchInput {
  query: string;
  history: { role: string; content: string }[];
  digest?: string;
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
  intent: string;
  intentKind?: WebIntentKind;
  plannedQueries: string[];
  rounds: WebRoundTelemetry[];
  providerCalls: number;
  enginesTried: string[];
  finalConfidence: number;
  finalLabel: RetrievalLabel;
  agreement: SourceAgreement;
  fetchFailures: FetchFailure[];
  recovery: RecoveryStrategy[];
}

export interface RunWebSearchResult {
  context: string[];
  sourceDocuments: WebSourceDocument[];
  telemetry: WebSearchTelemetry;
}

const contentCountOf = (results: WebSearchResult[]): number =>
  results.filter((result) => result.content?.trim()).length;

const matchesSiteRestriction = (url: string, domain: string): boolean => {
  const host = hostname(url);
  return host === domain || host.endsWith(`.${domain}`);
};

const logDevWebSearch = (label: string, payload: object): void => {
  if (__DEV__) console.log(`${label} ${JSON.stringify(payload)}`);
};

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
    intent: '',
    plannedQueries: [],
    rounds: [],
    providerCalls: 0,
    enginesTried: [],
    finalConfidence: 0,
    finalLabel: 'incorrect',
    agreement: NO_AGREEMENT,
    fetchFailures: [],
    recovery: [],
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

  if (isSmallTalk(query)) {
    emit({ type: 'skipped' });
    return empty('gated');
  }

  emit({ type: 'objectives' });

  const plan = await planWebSearch(query, history, generate, {
    ...(input.today ? { today: input.today } : {}),
    ...(input.profile ? { rewrite: input.profile.webPlanner === 'llm' } : {}),
    ...(input.digest ? { digest: input.digest } : {}),
  });
  let baseQueries = dedupeQueries(plan.queries);
  telemetry.needsSearch = plan.needsSearch;
  telemetry.intent = plan.intent;
  telemetry.intentKind = plan.kind;
  logDevWebSearch('Web search plan', {
    needsSearch: plan.needsSearch,
    kind: plan.kind,
    intent: plan.intent,
    queries: baseQueries,
    expects: plan.expects ?? [],
  });
  telemetry.plannedQueries = baseQueries;
  const rankingQuery = plan.intent ? `${query} ${plan.intent}` : query;
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
  ): Promise<WebSearchResult[][]> => {
    const out: WebSearchResult[][] = [];
    for (const q of queries) {
      const perQuery: WebSearchResult[] = [];
      out.push(perQuery);
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
          if (
            plan.siteRestriction &&
            !matchesSiteRestriction(item.url, plan.siteRestriction)
          ) {
            continue;
          }
          const listing = listingFingerprint(item);
          const keys = [`u:${item.url}`, ...(listing ? [`l:${listing}`] : [])];
          if (keys.some((key) => seen.has(key))) continue;
          keys.forEach((key) => seen.add(key));
          perQuery.push({ ...item, sourceQuery: q });
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
    if (!page.ok && page.reason) {
      telemetry.fetchFailures.push({
        url: page.url,
        host: page.host,
        reason: page.reason,
      });
    }
    emit({
      type: page.ok ? 'fetched' : 'failed',
      host: page.host,
      url: page.url,
      ...(page.reason ? { reason: page.reason } : {}),
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
        semanticQuery: plan.intent ? `${plan.intent}. ${query}` : query,
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
            topKForBudget(
              input.contextCharBudget,
              input.profile?.webRetrievalTopK
            )
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
    groups: WebSearchResult[][],
    cap: number,
    singleWave = false
  ): Promise<{
    grounded: WebSearchResult[];
    evaluation: RetrievalEvaluation;
    contentCount: number;
    agreement: SourceAgreement;
    enrichedPages: number;
    waves: number;
  }> => {
    const capped = fairRankByListingRelevance(groups, rankingQuery, cap, {
      kind: plan.kind,
      scopeYears: scopeYearsOf([...baseQueries, query]),
    });
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
      !singleWave &&
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
  const dropForeignScript = <T extends WebSearchResult>(group: T[]): T[] => {
    const sameScript: T[] = [];
    const foreign: T[] = [];
    for (const item of group) {
      const text = `${item.title} ${item.snippet ?? ''}`;
      (isForeignScript(text, query) ? foreign : sameScript).push(item);
    }
    if (foreign.length === 0) return sameScript;
    return sameScript.length >= WEB_MIN_SAME_SCRIPT_RESULTS
      ? sameScript
      : [...sameScript, ...foreign];
  };
  let foundGroups = (await runQueries(baseQueries, 1, seen)).map(
    dropForeignScript
  );
  const verbatim = verbatimQueryFor(query, baseQueries);
  if (
    verbatim &&
    foundGroups.flat().length < WEB_VERBATIM_MIN_RESULTS &&
    !signal?.aborted
  ) {
    const rescued = (await runQueries([verbatim], 1, seen)).map(
      dropForeignScript
    );
    foundGroups = [...foundGroups, ...rescued];
    baseQueries = [...baseQueries, verbatim];
    telemetry.plannedQueries = baseQueries;
  }
  const fallbackQueries = plan.fallbackQueries ?? [];
  if (
    foundGroups.flat().length === 0 &&
    fallbackQueries.length > 0 &&
    !signal?.aborted
  ) {
    const rescued = (await runQueries(fallbackQueries, 1, seen)).map(
      dropForeignScript
    );
    foundGroups = [...foundGroups, ...rescued];
    baseQueries = [...baseQueries, ...fallbackQueries];
    telemetry.plannedQueries = baseQueries;
  }
  const found = foundGroups.flat();
  const outcome = await groundAndEvaluate(foundGroups, WEB_SEARCH_MAX_RESULTS);

  let finalResults = outcome.grounded;
  let evaluation = outcome.evaluation;
  let agreement = outcome.agreement;
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

  if (WEB_RECOVERY_ENABLED && !signal?.aborted) {
    const recovery = planFetchRecovery({
      query,
      ...(plan.intent ? { intent: plan.intent } : {}),
      failures: telemetry.fetchFailures,
      triedQueries: baseQueries,
      needsMore: outcome.contentCount === 0 || evaluation.shouldCorrect,
    });
    telemetry.recovery = recovery.strategies;
    if (recovery.strategies.length > 0) {
      const recoveryQueries = recovery.strategies.map(
        (strategy) => strategy.query
      );
      emit({ type: 'recovering', round: 2 });
      const deadHosts = new Set(recovery.deadHosts);
      const recoveryGroups = (await runQueries(recoveryQueries, 2, seen)).map(
        (group) =>
          promotePrimarySources(
            dropForeignScript(group).filter(
              (item) => !deadHosts.has(hostname(item.url))
            ),
            recovery.subject
          )
      );
      const recovered = recoveryGroups.flat();
      if (recovered.length > 0) {
        const second = await groundAndEvaluate(
          recoveryGroups,
          WEB_RECOVERY_MAX_RESULTS,
          true
        );
        const merged = dedupeByBody([...finalResults, ...second.grounded]);
        const rescored = await score(merged, merged.length);
        telemetry.rounds.push({
          round: 2,
          queries: recoveryQueries,
          resultCount: recovered.length,
          contentCount: rescored.contentCount,
          confidence: rescored.evaluation.confidence,
          label: rescored.evaluation.label,
          enrichedPages: second.enrichedPages,
          enrichWaves: second.waves,
          independentHosts: rescored.agreement.independentHosts,
          corroboratedClaims: rescored.agreement.corroborated.length,
        });
        finalResults = rescored.grounded;
        evaluation = rescored.evaluation;
        agreement = rescored.agreement;
      }
    }
  }

  finalResults = promoteVerifiedProducts(
    demoteUnaskedVariants(promoteTitleConsensus(finalResults, query), query)
  );

  if (evaluation.shouldCorrect && finalResults.length > 0) {
    emit({ type: 'weak' });
  }
  emit({ type: 'done' });
  telemetry.providerCalls = providerCalls;
  telemetry.finalConfidence = evaluation.confidence;
  telemetry.finalLabel = evaluation.label;
  telemetry.agreement = agreement;
  logDevWebSearch('Web search outcome', {
    results: finalResults.length,
    withContent: contentCountOf(finalResults),
    confidence: Number(evaluation.confidence.toFixed(2)),
    label: evaluation.label,
    rounds: telemetry.rounds.map((round) => ({
      queries: round.queries,
      results: round.resultCount,
      withContent: round.contentCount,
      label: round.label,
    })),
    fetchFailures: telemetry.fetchFailures.map(
      (failure) => `${failure.host}:${failure.reason}`
    ),
  });

  if (finalResults.length === 0) {
    return { context: [], sourceDocuments: [], telemetry };
  }

  const label =
    baseQueries.length > 1 ? baseQueries.join(' + ') : baseQueries[0];
  const web = webResultsToContext(
    finalResults,
    label,
    input.contextOffset ?? 0,
    input.contextCharBudget,
    {
      labelSubQueries: plan.queries.length > 1,
      expects: plan.expects,
      displayQuery: query,
      intent: plan.kind,
    }
  );
  return {
    context: web.context,
    sourceDocuments: web.sourceDocuments,
    telemetry,
  };
};
