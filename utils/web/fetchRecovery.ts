import type { WebSearchResult } from './types';
import type { FetchFailure } from './fetchFailure';
import { isHostLevelFailure, isRecoverableFailure } from './fetchFailure';
import { namedEntitiesIn } from './buildSearchQuery';
import { hostname } from './webResultsToContext';
import { extractQueryTerms, foldForMatching } from '../queryTerms';
import {
  WEB_RECOVERY_HOST_FAILURE_LIMIT,
  WEB_RECOVERY_MAX_EXCLUSIONS,
  WEB_RECOVERY_MAX_QUERIES,
  WEB_RECOVERY_SUBJECT_MAX_TERMS,
} from '../../constants/web';

export type RecoveryKind = 'primary-source' | 'alternate-page' | 'restate';

export interface RecoveryStrategy {
  kind: RecoveryKind;
  query: string;
  host?: string;
}

export interface FetchRecoveryPlan {
  strategies: RecoveryStrategy[];
  deadHosts: string[];
  subject: string;
}

export interface FetchRecoveryInput {
  query: string;
  intent?: string;
  failures: FetchFailure[];
  triedQueries: string[];
  needsMore: boolean;
}

const MIN_SUBJECT_TERM_CHARS = 3;
const MIN_DOMAIN_TOKEN_CHARS = 4;

const normalizeQuery = (query: string): string =>
  foldForMatching(query).replace(/\s+/g, ' ').trim();

export const subjectOfQuery = (query: string): string => {
  const entities = namedEntitiesIn(query);
  if (entities.length > 0) {
    return entities.reduce((longest, entity) =>
      entity.length > longest.length ? entity : longest
    );
  }
  const terms = [...extractQueryTerms(query)].filter(
    (term) => term.length >= MIN_SUBJECT_TERM_CHARS
  );
  return terms.slice(0, WEB_RECOVERY_SUBJECT_MAX_TERMS).join(' ');
};

const domainTokens = (host: string): string[] =>
  foldForMatching(host)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= MIN_DOMAIN_TOKEN_CHARS);

export const looksLikePrimarySource = (
  url: string,
  subject: string
): boolean => {
  if (!subject.trim()) return false;
  const tokens = domainTokens(hostname(url));
  if (tokens.length === 0) return false;
  const subjectTokens = foldForMatching(subject)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= MIN_DOMAIN_TOKEN_CHARS);
  return subjectTokens.some((token) =>
    tokens.some((domain) => domain === token || domain.includes(token))
  );
};

export const promotePrimarySources = <T extends WebSearchResult>(
  results: T[],
  subject: string
): T[] => {
  if (results.length < 2 || !subject.trim()) return results;
  const primary = results.filter((result) =>
    looksLikePrimarySource(result.url, subject)
  );
  if (primary.length === 0 || primary.length === results.length) return results;
  return [
    ...primary,
    ...results.filter((result) => !looksLikePrimarySource(result.url, subject)),
  ];
};

export const planFetchRecovery = ({
  query,
  intent,
  failures,
  triedQueries,
  needsMore,
}: FetchRecoveryInput): FetchRecoveryPlan => {
  const subject = subjectOfQuery(query);
  const recoverable = failures.filter((failure) =>
    isRecoverableFailure(failure.reason)
  );
  const failuresPerHost = new Map<string, number>();
  for (const failure of recoverable) {
    failuresPerHost.set(
      failure.host,
      (failuresPerHost.get(failure.host) ?? 0) + 1
    );
  }
  const isDeadHost = (host: string, reason: FetchFailure['reason']): boolean =>
    isHostLevelFailure(reason) ||
    (failuresPerHost.get(host) ?? 0) >= WEB_RECOVERY_HOST_FAILURE_LIMIT;
  const deadHosts = [
    ...new Set(
      recoverable
        .filter((failure) => isDeadHost(failure.host, failure.reason))
        .map((failure) => failure.host)
    ),
  ];
  if (!needsMore || recoverable.length === 0) {
    return { strategies: [], deadHosts, subject };
  }

  const seen = new Set(triedQueries.map(normalizeQuery));
  const usable = (strategy: RecoveryStrategy): RecoveryStrategy | null => {
    const key = normalizeQuery(strategy.query);
    return key && !seen.has(key) ? strategy : null;
  };

  const base = subject.trim() || query.trim();
  const exclusions = deadHosts
    .slice(0, WEB_RECOVERY_MAX_EXCLUSIONS)
    .map((host) => `-site:${host}`)
    .join(' ');
  const primarySource = base
    ? usable({
        kind: 'primary-source',
        query: exclusions ? `${base} ${exclusions}` : base,
      })
    : null;

  const alternateHost = [
    ...new Set(
      recoverable
        .filter((failure) => !isDeadHost(failure.host, failure.reason))
        .map((failure) => failure.host)
    ),
  ][0];
  const alternatePage = alternateHost
    ? usable({
        kind: 'alternate-page',
        query: `site:${alternateHost} ${subject || query}`.trim(),
        host: alternateHost,
      })
    : null;

  const restate = intent?.trim()
    ? usable({ kind: 'restate', query: intent.trim() })
    : null;

  const preferred = deadHosts.length > 0 ? primarySource : alternatePage;
  const chosen = [preferred, primarySource, alternatePage, restate].find(
    (strategy): strategy is RecoveryStrategy => strategy !== null
  );

  return {
    strategies: chosen ? [chosen].slice(0, WEB_RECOVERY_MAX_QUERIES) : [],
    deadHosts,
    subject,
  };
};
