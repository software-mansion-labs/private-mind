import { detectQuestionLanguage } from '../questionLanguage';
import { extractQueryTerms, foldForMatching, stemPrefix } from '../queryTerms';
import {
  RECALL_MESSAGE_MAX_CHARS,
  RECALL_SPECIFIC_TERM_WEIGHT,
} from '../../constants/conversation-memory';

export interface WeightedTerm {
  stem: string;
  weight: number;
  numeric: boolean;
}

const NUMBER_TOKEN = /\d+/g;
const CAPITALISED_WORD = /\p{Lu}[\p{L}\p{N}]+/gu;
const SENTENCE_SPLIT = /(?<=[.!?\n])\s+|(?<=[।۔؟。！？])\s*/u;
const ELLIPSIS = '…';

const stemOf = (term: string): string => stemPrefix(foldForMatching(term));

const specificStems = (question: string): Set<string> => {
  const names = [...question.matchAll(CAPITALISED_WORD)]
    .filter((match) => {
      const before = question.slice(0, match.index).trim();
      return before.length > 0 && !/[.!?]$/.test(before);
    })
    .map((match) => stemOf(match[0]));
  return new Set(names);
};

export const questionTermsFor = (question: string): WeightedTerm[] => {
  const language = detectQuestionLanguage(question)?.code;
  const specific = specificStems(question);
  const numbers = new Set(question.match(NUMBER_TOKEN) ?? []);
  const terms = new Map<string, WeightedTerm>();
  for (const term of extractQueryTerms(question, language)) {
    if (/^\d+$/.test(term)) continue;
    const stem = stemOf(term);
    terms.set(stem, {
      stem,
      weight: specific.has(stem) ? RECALL_SPECIFIC_TERM_WEIGHT : 1,
      numeric: false,
    });
  }
  for (const number of numbers) {
    terms.set(number, {
      stem: number,
      weight: RECALL_SPECIFIC_TERM_WEIGHT,
      numeric: true,
    });
  }
  return [...terms.values()];
};

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const startsAWord = (folded: string, stem: string): boolean =>
  new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escapeRegExp(stem)}`, 'u').test(
    folded
  );

export const weightedCoverage = (
  text: string,
  terms: WeightedTerm[]
): number => {
  if (terms.length === 0) return 0;
  const folded = foldForMatching(text);
  const numbers = new Set(folded.match(NUMBER_TOKEN) ?? []);
  let total = 0;
  let hit = 0;
  for (const term of terms) {
    total += term.weight;
    const present = term.numeric
      ? numbers.has(term.stem)
      : startsAWord(folded, term.stem);
    if (present) hit += term.weight;
  }
  return total === 0 ? 0 : hit / total;
};

const hardSlice = (text: string, max: number): string => {
  const end = max > 0 && /[\ud800-\udbff]/.test(text[max - 1]!) ? max - 1 : max;
  return text.slice(0, end);
};

const windowsOf = (text: string): string[] => {
  const sentences = text.split(SENTENCE_SPLIT).filter(Boolean);
  const windows: string[] = [];
  for (let start = 0; start < sentences.length; start++) {
    let window = '';
    for (let end = start; end < sentences.length; end++) {
      const next = window ? `${window} ${sentences[end]}` : sentences[end]!;
      if (next.length > RECALL_MESSAGE_MAX_CHARS) break;
      window = next;
    }
    windows.push(
      window || hardSlice(sentences[start]!, RECALL_MESSAGE_MAX_CHARS)
    );
  }
  return windows;
};

export const bestWindow = (
  text: string,
  terms: WeightedTerm[]
): { text: string; score: number } => {
  if (text.length <= RECALL_MESSAGE_MAX_CHARS) {
    return { text, score: weightedCoverage(text, terms) };
  }
  let best = { text: '', score: -1 };
  for (const window of windowsOf(text)) {
    const score = weightedCoverage(window, terms);
    if (score > best.score) best = { text: window, score };
  }
  const lead = text.startsWith(best.text) ? '' : ELLIPSIS;
  const tail = text.endsWith(best.text) ? '' : ELLIPSIS;
  return { text: `${lead}${best.text}${tail}`, score: best.score };
};
