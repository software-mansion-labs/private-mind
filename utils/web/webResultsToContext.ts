import type { WebContext, WebSearchResult, WebSourceDocument } from './types';
import {
  WEB_CONTENT_MAX_CHARS,
  WEB_SNIPPET_MAX_CHARS,
} from '../../constants/web';
import { sourceBlock } from '../contextUtils';
import { extractQueryTerms, foldForMatching, stemPrefix } from '../queryTerms';
import { detectQuestionLanguage } from '../questionLanguage';
import { neutralizeDelimiters } from './security/untrustedContent';

const truncate = (text: string, max: number): string =>
  text.length <= max
    ? text
    : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;

export const hostname = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const PASSAGE_MAX_LEN = 320;

const SENTENCE_END =
  /[^.!?\n。！？।॥۔؟]+[.!?\n。！？।॥۔؟]+|[^.!?\n。！？।॥۔؟]+$/g;

const PASSAGE_TARGET_LEN = 200;
const CELL_MAX_LEN = 24;
const LEAD_WINDOW = 12;
const LEAD_BONUS = 1.5;

const RECORD_MAX_PASSAGES = 8;
const RECORD_MAX_CHARS = 400;

const FRAGMENT_MAX_CHARS = 120;

const ENDS_SENTENCE = /[.!?。！？।॥۔؟]["'”’)\]]?$/;

const CUTOFF_PERCENTILE = 0.1;

const MIN_SOURCE_EXCERPT_CHARS = 300;

const coalesceLines = (text: string, target: number): string[] => {
  const passages: string[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) passages.push(buffer);
    buffer = '';
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.length > CELL_MAX_LEN) {
      flush();
      passages.push(line);
    } else if (!buffer) {
      buffer = line;
    } else if (buffer.length + 1 + line.length <= target) {
      buffer = `${buffer} ${line}`;
    } else {
      flush();
      buffer = line;
    }
  }
  flush();
  return passages;
};

const splitIntoPassages = (text: string, budget: number): string[] => {
  const passages: string[] = [];
  const target = Math.max(CELL_MAX_LEN, Math.min(PASSAGE_TARGET_LEN, budget));
  for (const block of coalesceLines(text, target)) {
    const sentences =
      block.length <= PASSAGE_MAX_LEN
        ? [block]
        : (block.match(SENTENCE_END) ?? [block]);
    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;
      if (s.length <= PASSAGE_MAX_LEN) {
        passages.push(s);
        continue;
      }
      for (let i = 0; i < s.length; i += PASSAGE_MAX_LEN) {
        passages.push(s.slice(i, i + PASSAGE_MAX_LEN).trim());
      }
    }
  }
  return passages.filter(Boolean);
};

const idfWeights = (folded: string[], needles: string[]): number[] =>
  needles.map((needle) => {
    const hits = folded.reduce(
      (count, passage) => count + (passage.includes(needle) ? 1 : 0),
      0
    );
    return hits === 0 ? 0 : Math.log(folded.length / hits);
  });

const containsNeedle = (folded: string, needle: string): boolean =>
  needle.length >= 4
    ? folded.includes(needle)
    : new RegExp(`(?<![\\p{L}\\p{N}])${needle}`, 'u').test(folded);

const MONEY_ANCHOR =
  /\d[\d\s.,]*\s?(?:zl|pln|eur|euro|usd|gbp|czk|chf)(?![\p{L}\p{N}])|[$€£¥]\s?\d|\d\s?[$€£¥]/giu;
const MONEY_BONUS = 2;

const scorePassage = (
  folded: string,
  needles: string[],
  weights: number[]
): number => {
  let score = 0;
  needles.forEach((needle, index) => {
    if (containsNeedle(folded, needle)) score += 2 * weights[index]!;
  });
  const digits = (folded.match(/\d/g) ?? []).length;
  if (digits === 0) return score;
  const money = (folded.match(MONEY_ANCHOR) ?? []).length;
  if (money > 0) score += Math.min(1, money / 2) * MONEY_BONUS;
  const words = (folded.match(/\p{L}{3,}/gu) ?? []).length;
  const proseRatio = Math.min(1, words / Math.max(4, digits / 2));
  return score + Math.min(1, digits / 8) * proseRatio;
};

export const selectRelevantContent = (
  content: string,
  query: string | undefined,
  maxChars: number
): string => {
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const needles = query
    ? [
        ...new Set(
          [
            ...extractQueryTerms(query, detectQuestionLanguage(query)?.code),
          ].map((term) => stemPrefix(foldForMatching(term)))
        ),
      ]
    : [];
  if (needles.length === 0) return truncate(trimmed, maxChars);

  const all = splitIntoPassages(trimmed, maxChars);
  const foldedAll = all.map(foldForMatching);
  const weights = idfWeights(foldedAll, needles);

  const leadWindow = Math.min(LEAD_WINDOW, all.length);
  const leadBonus = (index: number): number =>
    index < leadWindow ? LEAD_BONUS * (1 - index / leadWindow) : 0;

  const seenText = new Set<string>();
  const scored = all
    .map((text, index) => ({
      text,
      index,
      score: scorePassage(foldedAll[index]!, needles, weights),
    }))
    .filter((passage) => {
      const key = foldedAll[passage.index]!;
      if (seenText.has(key)) return false;
      seenText.add(key);
      return true;
    });
  if (scored.every((passage) => passage.score === 0)) {
    return truncate(trimmed, maxChars);
  }

  const ranked = scored
    .map((passage) => passage.score)
    .filter((score) => score > 0)
    .sort((a, b) => b - a);
  const reference =
    ranked[Math.floor(ranked.length * CUTOFF_PERCENTILE)] ?? ranked[0] ?? 0;
  const cutoff = reference / 2;

  const qualified = scored.filter((passage) => passage.score >= cutoff);
  const isQualified = new Set(qualified.map((passage) => passage.index));
  const costOf = (index: number): number => all[index]!.length + 1;

  const units = qualified
    .map((passage) => {
      const members = [passage.index];
      let cost = costOf(passage.index);
      const reach = ENDS_SENTENCE.test(passage.text) ? 2 : RECORD_MAX_PASSAGES;
      for (
        let next = passage.index + 1;
        next < all.length &&
        members.length < reach &&
        !isQualified.has(next) &&
        all[next]!.length <= FRAGMENT_MAX_CHARS;
        next++
      ) {
        if (cost + costOf(next) > RECORD_MAX_CHARS) break;
        members.push(next);
        cost += costOf(next);
      }
      return { members, priority: passage.score + leadBonus(passage.index) };
    })
    .sort((a, b) => b.priority - a.priority || a.members[0]! - b.members[0]!);

  const claimed = new Set(units.flatMap((unit) => unit.members));

  let used = 0;
  const taken: number[] = [];
  const takenSet = new Set<number>();
  const take = (index: number): void => {
    if (takenSet.has(index)) return;
    const cost = costOf(index);
    if (used + cost > maxChars) return;
    used += cost;
    taken.push(index);
    takenSet.add(index);
  };

  for (const unit of units) {
    const cost = unit.members.reduce(
      (total, index) => (takenSet.has(index) ? total : total + costOf(index)),
      0
    );
    if (used + cost <= maxChars) unit.members.forEach(take);
    else take(unit.members[0]!);
  }

  const fillers = scored
    .filter((passage) => passage.score > 0 && !claimed.has(passage.index))
    .sort(
      (a, b) =>
        b.score + leadBonus(b.index) - (a.score + leadBonus(a.index)) ||
        a.index - b.index
    );
  for (const passage of fillers) take(passage.index);

  const excerpt = taken
    .sort((a, b) => a - b)
    .map((index) => all[index]!)
    .join(' ');
  return excerpt || truncate(trimmed, maxChars);
};

const sourceBudgets = (
  totalMaxChars: number | undefined,
  count: number
): number[] => {
  if (!totalMaxChars) return Array(count).fill(WEB_CONTENT_MAX_CHARS);
  const weights = Array.from({ length: count }, (_, rank) => 1 / (rank + 1));
  const sum = weights.reduce((total, weight) => total + weight, 0);
  return weights.map((weight) =>
    Math.max(
      MIN_SOURCE_EXCERPT_CHARS,
      Math.floor((totalMaxChars * weight) / sum)
    )
  );
};

export const webResultsToContext = (
  results: WebSearchResult[],
  query?: string,
  startIndex = 0,
  totalMaxChars?: number
): WebContext => {
  const context: string[] = [];
  const sourceDocuments: WebSourceDocument[] = [];

  const opened = results.filter((result) => result.content);
  const used = opened.length > 0 ? opened : results;
  const budgets = sourceBudgets(totalMaxChars, used.length);

  used.forEach((result, index) => {
    const name = neutralizeDelimiters(result.title || hostname(result.url));
    const snippet = truncate(
      (result.snippet ?? '').trim(),
      WEB_SNIPPET_MAX_CHARS
    );
    const relevant = result.content
      ? selectRelevantContent(result.content, query, budgets[index]!)
      : '';
    const rawPassage = relevant
      ? snippet
        ? `${relevant}\n${snippet}`
        : relevant
      : snippet;

    context.push(
      sourceBlock(startIndex + index, name, neutralizeDelimiters(rawPassage))
    );

    sourceDocuments.push({
      kind: 'web',
      name,
      url: result.url,
      read: !!relevant,
      passage: snippet,
      query: query?.trim() || undefined,
      similarity: used.length > 1 ? 1 - index / used.length : 1,
    });
  });

  for (const result of results) {
    if (used.includes(result)) continue;
    sourceDocuments.push({
      kind: 'web',
      name: neutralizeDelimiters(result.title || hostname(result.url)),
      url: result.url,
      read: false,
      query: query?.trim() || undefined,
    });
  }

  return { context, sourceDocuments };
};
