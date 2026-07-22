import {
  extractJsonObject,
  sanitizeSearchQuery,
  type QueryRewriteFn,
  type WebSearchPlan,
} from './buildSearchQuery';
import { hostname } from './webResultsToContext';
import type { WebSearchResult } from './types';
import {
  WEB_CORRECTIVE_EVIDENCE_MAX_CHARS,
  WEB_CORRECTIVE_EVIDENCE_PAGES,
} from '../../constants/web';

const collapse = (text: string): string => text.trim().replace(/\s+/g, ' ');
const norm = (text: string): string => collapse(text).toLowerCase();

const freshnessCheck = (
  query: string,
  alreadyRun: string[]
): ((candidate: string) => boolean) => {
  const ran = new Set(alreadyRun.map(norm));
  const original = norm(query);
  return (candidate: string): boolean => {
    const c = norm(candidate);
    return !!c && c !== original && !ran.has(c);
  };
};

export const reformulateForCorrection = (
  query: string,
  plan: Pick<WebSearchPlan, 'intent' | 'queries'>,
  alreadyRun: string[]
): string => {
  const isFresh = freshnessCheck(query, alreadyRun);

  const unusedPlanned = (plan.queries ?? []).find(isFresh);
  if (unusedPlanned) return collapse(unusedPlanned);

  if (plan.intent && isFresh(plan.intent)) return collapse(plan.intent);

  const broadenSource = collapse(alreadyRun[0] ?? '') || collapse(query);
  const tokens = broadenSource.split(' ').filter(Boolean);
  if (tokens.length >= 3) {
    const broadened = tokens.slice(0, -1).join(' ');
    if (isFresh(broadened)) return broadened;
  }

  return '';
};

export interface CorrectiveEvidence {
  host: string;
  title: string;
  excerpt: string;
}

export const buildCorrectiveEvidence = (
  results: WebSearchResult[]
): CorrectiveEvidence[] =>
  results
    .map((result) => ({
      host: result.url ? hostname(result.url) : '',
      title: collapse(result.title ?? ''),
      excerpt: collapse(result.content || result.snippet || '').slice(
        0,
        WEB_CORRECTIVE_EVIDENCE_MAX_CHARS
      ),
    }))
    .filter((item) => item.excerpt || item.title)
    .slice(0, WEB_CORRECTIVE_EVIDENCE_PAGES);

const CORRECTIVE_SYSTEM_PROMPT = (targetLanguage: string): string =>
  '/no_think A web search did not answer the question. You get excerpts from ' +
  'the pages it found. Write ONE better search query.\n' +
  'Respond with ONLY one JSON object, no other text and no reasoning:\n' +
  '{"query": "<new search keywords>"}\n' +
  'Rules:\n' +
  `- Write the query in ${targetLanguage}.\n` +
  '- Keep names of people, places and organisations exactly as spelled in the ' +
  'excerpts. Never translate a name.\n' +
  '- If a page points somewhere better (a named registry, official site, ' +
  'dataset or organisation), build the query around THAT lead.\n' +
  '- Keywords a search engine matches, NOT a sentence, under 12 words.\n' +
  '- NEVER repeat a query listed as already tried. A different capitalisation ' +
  'is still the same query.\n' +
  '- If nothing better is possible, use {"query": ""}.\n' +
  'Examples:\n' +
  'Question: population of Cagliari 2026\n' +
  'Already tried: Cagliari population 2026\n' +
  'Excerpts:\n- citypop.example — "Municipal figures are published by ISTAT, ' +
  'the national statistics institute."\n' +
  '{"query": "ISTAT Cagliari popolazione 2026"}\n' +
  'Question: height of the cathedral bell tower in Cagliari\n' +
  'Already tried: Cagliari cathedral bell height\n' +
  'Excerpts:\n- it.wikipedia.org — "Cattedrale di Santa Maria (Cagliari): il ' +
  'campanile domina il quartiere Castello."\n' +
  '{"query": "Cattedrale di Cagliari campanile altezza"}\n' +
  'Question: opening hours of the Pergamon Museum\n' +
  'Already tried: Pergamon Museum opening hours\n' +
  'Excerpts:\n- blog.example — "I visited last summer, it was lovely."\n' +
  '{"query": "Pergamonmuseum Öffnungszeiten"}\n' +
  'Question: who won the 2025 Giro stage 5\n' +
  'Already tried: Giro 2025 stage 5 winner\n' +
  'Excerpts:\n- giro.example — "Tappa 5: classifica completa."\n' +
  '{"query": "Giro 2025 tappa 5 vincitore"}\n' +
  'Question: capital of Sardinia\n' +
  'Already tried: Sardinia capital\n' +
  'Excerpts:\n- en.wikipedia.org — "Cagliari is the capital of Sardinia."\n' +
  '{"query": ""}';

export const parseCorrectiveQuery = (raw: string): string => {
  const obj = extractJsonObject(raw);
  if (!obj || typeof obj.query !== 'string') return '';
  return sanitizeSearchQuery(obj.query);
};

export const reformulateWithEvidence = async ({
  query,
  alreadyRun,
  evidence,
  generate,
  targetLanguage = 'English',
}: {
  query: string;
  alreadyRun: string[];
  evidence: CorrectiveEvidence[];
  generate: QueryRewriteFn;
  targetLanguage?: string;
}): Promise<string> => {
  if (!query.trim() || evidence.length === 0) return '';

  const excerpts = evidence
    .map(
      (item) =>
        `- ${item.host || 'page'} — "${item.title}${
          item.title && item.excerpt ? ': ' : ''
        }${item.excerpt}"`
    )
    .join('\n');
  const tried = alreadyRun.filter(Boolean).join(', ');

  let raw: string;
  try {
    raw = await generate([
      { role: 'system', content: CORRECTIVE_SYSTEM_PROMPT(targetLanguage) },
      {
        role: 'user',
        content:
          `Question: ${collapse(query)}\n` +
          (tried ? `Already tried: ${tried}\n` : '') +
          `Excerpts:\n${excerpts}\n\nJSON:`,
      },
    ]);
  } catch {
    return '';
  }

  const candidate = parseCorrectiveQuery(raw);
  if (!candidate) return '';
  return freshnessCheck(query, alreadyRun)(candidate) ? candidate : '';
};
