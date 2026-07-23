import type { WebSearchResult } from './types';
import { hostname } from './webResultsToContext';
import {
  WEB_AGREEMENT_MAX_CLAIMS,
  WEB_AGREEMENT_MAX_TEXT_CHARS,
  WEB_AGREEMENT_MIN_BARE_VALUE,
  WEB_AGREEMENT_MIN_HOSTS,
} from '../../constants/web';

export interface SourceClaim {
  value: string;
  unit: string;
  hosts: string[];
}

export interface SourceAgreement {
  independentHosts: number;
  repeatedHostResults: number;
  corroborated: SourceClaim[];
  singleSourced: SourceClaim[];
  agreementRatio: number;
}

const MULTI_PART_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'me.uk',
  'net.uk',
  'com.pl',
  'net.pl',
  'org.pl',
  'edu.pl',
  'gov.pl',
  'com.au',
  'net.au',
  'org.au',
  'co.jp',
  'or.jp',
  'ne.jp',
  'co.nz',
  'com.br',
  'com.cn',
  'com.tr',
  'co.in',
  'co.za',
  'co.kr',
  'com.mx',
  'com.ar',
  'com.sg',
  'com.hk',
  'co.il',
  'com.ua',
  'co.th',
  'com.tw',
]);

export const registrableDomain = (url: string): string => {
  const host = hostname(url).toLowerCase();
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  return MULTI_PART_SUFFIXES.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
};

const CLAIM_PATTERN =
  /(^|[^\p{L}\p{N}])(\d{1,3}(?:[ \u00a0.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)\s*(%|°c|°f|km²|km2|km|m²|m2|mm|cm|kg|ha|zł|pln|usd|eur|gbp|mln|mld|tys|bn|m)?(?![\p{L}\p{N}])/giu;

const CURRENCY_PREFIX: Record<string, string> = {
  '$': 'usd',
  '€': 'eur',
  '£': 'gbp',
  '₴': 'uah',
};

const canonicalValue = (raw: string): string | null => {
  const grouped = raw.replace(/[ \u00a0]/g, '');
  const normalised = grouped
    .replace(/[.,](\d{3})(?![\d])/g, '$1')
    .replace(',', '.');
  const value = Number(normalised);
  if (!Number.isFinite(value)) return null;
  return String(value);
};

const extractClaims = (text: string): Map<string, SourceClaim> => {
  const found = new Map<string, SourceClaim>();
  const scanned = text.slice(0, WEB_AGREEMENT_MAX_TEXT_CHARS);
  for (const match of scanned.matchAll(CLAIM_PATTERN)) {
    const [, boundary, rawValue, rawUnit] = match;
    const value = canonicalValue(rawValue);
    if (value === null) continue;
    const unit =
      (rawUnit ?? '').toLowerCase() || CURRENCY_PREFIX[boundary] || '';
    if (!unit && Math.abs(Number(value)) < WEB_AGREEMENT_MIN_BARE_VALUE) {
      continue;
    }
    const key = unit ? `${value} ${unit}` : value;
    if (!found.has(key)) found.set(key, { value, unit, hosts: [] });
  }
  return found;
};

const byHostCountThenValue = (a: SourceClaim, b: SourceClaim): number =>
  b.hosts.length - a.hosts.length ||
  Number(b.value) - Number(a.value) ||
  a.unit.localeCompare(b.unit);

export const analyzeSourceAgreement = (
  results: WebSearchResult[]
): SourceAgreement => {
  const hosts = new Set<string>();
  const claims = new Map<string, SourceClaim>();
  let repeatedHostResults = 0;

  for (const result of results) {
    const host = registrableDomain(result.url);
    if (!host) continue;
    if (hosts.has(host)) repeatedHostResults += 1;
    hosts.add(host);

    const text = `${result.snippet ?? ''} ${result.content ?? ''}`.trim();
    if (!text) continue;
    for (const [key, claim] of extractClaims(text)) {
      const existing = claims.get(key);
      if (!existing) {
        claims.set(key, { ...claim, hosts: [host] });
      } else if (!existing.hosts.includes(host)) {
        existing.hosts.push(host);
      }
    }
  }

  const all = [...claims.values()].map((claim) => ({
    ...claim,
    hosts: [...claim.hosts].sort(),
  }));
  const corroborated = all.filter(
    (claim) => claim.hosts.length >= WEB_AGREEMENT_MIN_HOSTS
  );
  const singleSourced = all.filter(
    (claim) => claim.hosts.length < WEB_AGREEMENT_MIN_HOSTS
  );

  return {
    independentHosts: hosts.size,
    repeatedHostResults,
    agreementRatio: all.length ? corroborated.length / all.length : 0,
    corroborated: corroborated
      .sort(byHostCountThenValue)
      .slice(0, WEB_AGREEMENT_MAX_CLAIMS),
    singleSourced: singleSourced
      .sort(byHostCountThenValue)
      .slice(0, WEB_AGREEMENT_MAX_CLAIMS),
  };
};

export const summarizeAgreement = (
  agreement: SourceAgreement
): string | null => {
  const { independentHosts, corroborated } = agreement;
  if (independentHosts === 0) return null;
  if (independentHosts === 1) return 'All pages from one publisher';
  if (corroborated.length === 0) return null;
  const figures = corroborated.length === 1 ? 'figure' : 'figures';
  return `${corroborated.length} matching ${figures}`;
};
