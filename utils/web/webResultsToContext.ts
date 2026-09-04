import type {
  StructuredProduct,
  WebContext,
  WebSearchResult,
  WebSourceDocument,
} from './types';
import {
  WEB_CONTENT_MAX_CHARS,
  WEB_SNIPPET_MAX_CHARS,
} from '../../constants/web';
import { sourceBlock } from '../contextUtils';
import { extractQueryTerms, foldForMatching, stemPrefix } from '../queryTerms';
import { detectQuestionLanguage } from '../questionLanguage';
import { neutralizeDelimiters } from './security/untrustedContent';
import { VERIFIED_PRODUCT_MARKER } from './figureGrounding';
import type { WebIntentKind } from './intentKind';

const formatVerifiedProduct = (
  product: StructuredProduct | undefined
): string => {
  if (!product?.price) return '';
  const parts = [
    product.name ? `name="${product.name}"` : null,
    `price=${product.price}${product.currency ? ` ${product.currency}` : ''}`,
    product.availability ? `availability=${product.availability}` : null,
  ].filter((part): part is string => part !== null);
  return `${VERIFIED_PRODUCT_MARKER} ${parts.join(', ')}\n`;
};

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
      buffer = `${buffer}\n${line}`;
    } else {
      flush();
      buffer = line;
    }
  }
  flush();
  return passages;
};

const wordBoundaryBefore = (
  text: string,
  start: number,
  limit: number
): number => {
  if (limit >= text.length) return text.length;
  const space = text.lastIndexOf(' ', limit);
  return space > start + PASSAGE_MAX_LEN / 2 ? space : limit;
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
      for (let start = 0; start < s.length;) {
        const end = wordBoundaryBefore(s, start, start + PASSAGE_MAX_LEN);
        passages.push(s.slice(start, end).trim());
        start = end;
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

const WHEN_QUESTION =
  /\bkiedy\b|\bwhen\b|\bwann\b|\bquand\b|\bcu[aá]ndo\b|\bquando\b|когда|कब|\bمتى\b/i;
const DATE_IN_TEXT =
  /\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b|\b\d{1,2}\s?(?:sty|lut|mar|kwi|maj|cze|lip|sie|wrz|paz|lis|gru|jan|feb|apr|jun|jul|aug|sep|oct|nov|dec)/i;
const DATE_BONUS = 2;

const PRICE_QUESTION =
  /\bile\s+kosztuj|\bcen[ay]\b|\bcennik|\bkoszt\b|\bhow much\b|\bprice\b|\bcost\b|\bprecio\b|\bpreis\b|\bprix\b|цена/i;
const PRICE_BONUS = 4;
const NO_PRICE_FACTOR = 0.35;

export const MONEY_ANCHOR =
  /\d[\d\s.,]*\s?(?:zl(?:ot(?:ych|ego|emu|ymi|ym|y|e))?|pln|eur(?:o)?|usd|gbp|czk|chf|dolar(?:ow|ach|ami|em|a|y)?)(?![\p{L}\p{N}])|[$€£¥]\s?\d|\d\s?[$€£¥]/giu;
const MONEY_BONUS = 2;

const NUMBER_RUN = /\d[\d.,:]*\d|\d/g;
const FIGURES_BONUS = 3;
const FIGURES_SATURATION = 3;
const NO_FIGURE_FACTOR = 0.5;

const figuresOutsideNeedles = (folded: string, needles: string[]): number => {
  const rest = needles.reduce(
    (text, needle) => text.split(needle).join(' '),
    folded
  );
  return (rest.match(NUMBER_RUN) ?? []).length;
};

const TOPIC_NEEDLE_DISCOUNT = 0.5;

const RECORD_LINE =
  /^(?=[^:|\n]{0,40}\p{L})([^:|\n]{2,40}?)\s*[:|]\s*(\S.{0,79})$/u;
const RECORD_KEY_MAX_REPEATS = 2;

const recordKeys = (passage: string): string[] =>
  passage
    .split('\n')
    .map((line) => line.trim().match(RECORD_LINE)?.[1])
    .filter((key): key is string => key !== undefined)
    .map((key) => foldForMatching(key));

const creditedRecords = (passages: string[]): Set<number> => {
  const keysOf = passages.map(recordKeys);
  const keyCount = new Map<string, number>();
  keysOf
    .flat()
    .forEach((key) => keyCount.set(key, (keyCount.get(key) ?? 0) + 1));
  const isRecordLine = (index: number): boolean =>
    index >= 0 &&
    index < passages.length &&
    keysOf[index]!.length === 1 &&
    !passages[index]!.includes('\n');
  const credited = new Set<number>();
  keysOf.forEach((keys, index) => {
    const structured =
      keys.length >= 2 ||
      (isRecordLine(index) &&
        (isRecordLine(index - 1) || isRecordLine(index + 1)));
    const distinct = keys.some(
      (key) => keyCount.get(key)! <= RECORD_KEY_MAX_REPEATS
    );
    if (structured && distinct) credited.add(index);
  });
  return credited;
};

const parseAmount = (text: string): number | null => {
  const digits = text.match(/\d[\d\s.,]*/)?.[0].replace(/\s/g, '');
  if (!digits) return null;
  const decimal = digits.match(/[.,](\d{1,2})$/);
  const whole = (
    decimal ? digits.slice(0, -decimal[0].length) : digits
  ).replace(/[.,]/g, '');
  const value = Number(`${whole}.${decimal?.[1] ?? '0'}`);
  return Number.isFinite(value) ? value : null;
};

const AMOUNT_TOLERANCE = 0.005;

const isOtherAmount = (mention: string, verified: number | null): boolean => {
  if (verified === null) return false;
  const amount = parseAmount(mention);
  return (
    amount !== null && Math.abs(amount - verified) > verified * AMOUNT_TOLERANCE
  );
};

interface PassageScoring {
  needles: string[];
  weights: number[];
  topicNeedles: Set<string>;
  wantsDate: boolean;
  wantsPrice: boolean;
  wantsFigures: boolean;
  verifiedAmount: number | null;
}

interface PassageScore {
  score: number;
  answersQuestion: boolean;
}

const scorePassage = (
  folded: string,
  scoring: PassageScoring,
  creditedRecord: boolean
): PassageScore => {
  const {
    needles,
    weights,
    topicNeedles,
    wantsDate,
    wantsPrice,
    wantsFigures,
  } = scoring;
  let score = 0;
  let answersQuestion = creditedRecord;
  needles.forEach((needle, index) => {
    const topic = topicNeedles.has(needle);
    if (containsNeedle(folded, needle) || (creditedRecord && topic)) {
      score += 2 * weights[index]! * (topic ? TOPIC_NEEDLE_DISCOUNT : 1);
      answersQuestion = true;
    }
  });
  if (wantsDate && DATE_IN_TEXT.test(folded)) {
    score += DATE_BONUS;
    answersQuestion = true;
  }
  const mentions = folded.match(MONEY_ANCHOR) ?? [];
  if (wantsPrice) {
    if (mentions.length > 0) {
      score += PRICE_BONUS;
      answersQuestion = true;
    } else {
      score *= NO_PRICE_FACTOR;
    }
  }
  if (
    mentions.some((mention) => isOtherAmount(mention, scoring.verifiedAmount))
  ) {
    return { score: 0, answersQuestion: false };
  }
  if (mentions.length > 0)
    score += Math.min(1, mentions.length / 2) * MONEY_BONUS;
  if (wantsFigures) {
    const figures = figuresOutsideNeedles(folded, needles);
    if (figures > 0) {
      score += Math.min(1, figures / FIGURES_SATURATION) * FIGURES_BONUS;
      answersQuestion = true;
    } else {
      score *= NO_FIGURE_FACTOR;
    }
  }
  const digits = (folded.match(/\d/g) ?? []).length;
  if (digits > 0) {
    const words = (folded.match(/\p{L}{3,}/gu) ?? []).length;
    const proseRatio = creditedRecord
      ? 1
      : Math.min(1, words / Math.max(4, digits / 2));
    score += Math.min(1, digits / 8) * proseRatio;
  }
  return { score, answersQuestion };
};

const isSentenceLead = (passage: string): boolean =>
  !passage.includes('\n') && ENDS_SENTENCE.test(passage);

export interface SelectionOptions {
  title?: string;
  verifiedPrice?: string;
  intent?: WebIntentKind;
}

const DATED_INTENTS: ReadonlySet<WebIntentKind> = new Set([
  'date',
  'news',
  'event',
]);

export const selectRelevantContent = (
  content: string,
  query: string | undefined,
  maxChars: number,
  options: SelectionOptions = {}
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

  const verifiedAmount =
    options.verifiedPrice !== undefined
      ? parseAmount(options.verifiedPrice)
      : null;
  const { intent } = options;
  const wantsDate =
    (!!intent && DATED_INTENTS.has(intent)) ||
    (!!query && WHEN_QUESTION.test(query));
  const wantsPrice =
    verifiedAmount === null &&
    (intent === 'price' || (!!query && PRICE_QUESTION.test(query)));
  const wantsFigures = intent === 'specs';
  const all = splitIntoPassages(trimmed, maxChars);
  const foldedAll = all.map(foldForMatching);
  const foldedTitle = foldForMatching(options.title ?? '');
  const scoring: PassageScoring = {
    needles,
    weights: idfWeights(foldedAll, needles),
    topicNeedles: new Set(
      needles.filter((needle) => containsNeedle(foldedTitle, needle))
    ),
    wantsDate,
    wantsPrice,
    wantsFigures,
    verifiedAmount,
  };
  const credited =
    scoring.topicNeedles.size > 0 ? creditedRecords(all) : new Set<number>();

  const leadWindow = Math.min(LEAD_WINDOW, all.length);
  const leadBonus = (index: number): number =>
    index < leadWindow && isSentenceLead(all[index]!)
      ? LEAD_BONUS * (1 - index / leadWindow)
      : 0;

  const seenText = new Set<string>();
  const scored = all
    .map((text, index) => ({
      text,
      index,
      ...scorePassage(foldedAll[index]!, scoring, credited.has(index)),
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
    .filter(
      (passage) =>
        passage.score > 0 &&
        passage.answersQuestion &&
        !claimed.has(passage.index)
    )
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

const SNIPPET_REPEAT_SHARE = 0.6;
const SNIPPET_TOKEN = /\p{L}{4,}|\d[\d.,]*\d|\d/gu;

const snippetRepeatsExcerpt = (snippet: string, excerpt: string): boolean => {
  const folded = foldForMatching(excerpt);
  const tokens = [
    ...new Set(foldForMatching(snippet).match(SNIPPET_TOKEN) ?? []),
  ];
  if (tokens.length === 0) return true;
  const figures = tokens.filter((token) => /\d/.test(token));
  if (figures.some((figure) => !folded.includes(figure))) return false;
  const repeated = tokens.filter((token) => folded.includes(token)).length;
  return repeated >= tokens.length * SNIPPET_REPEAT_SHARE;
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

interface WebContextOptions {
  labelSubQueries?: boolean;
  displayQuery?: string;
  intent?: WebIntentKind;
}

export const webResultsToContext = (
  results: WebSearchResult[],
  query?: string,
  startIndex = 0,
  totalMaxChars?: number,
  options: WebContextOptions = {}
): WebContext => {
  const context: string[] = [];
  const sourceDocuments: WebSourceDocument[] = [];

  const withMaterial = results.filter(
    (result) => result.content || result.snippet?.trim()
  );
  const used = withMaterial.length > 0 ? withMaterial : results;
  const budgets = sourceBudgets(totalMaxChars, used.length);

  const recordedQuery = (options.displayQuery ?? query)?.trim() || undefined;
  const distinctQueries = new Set(
    (options.labelSubQueries ?? true)
      ? used.map((result) => result.sourceQuery).filter((q): q is string => !!q)
      : []
  );

  used.forEach((result, index) => {
    const name = neutralizeDelimiters(result.title || hostname(result.url));
    const snippet = truncate(
      (result.snippet ?? '').trim(),
      WEB_SNIPPET_MAX_CHARS
    );
    const budget = budgets[index]!;
    const select = (maxChars: number): string =>
      result.content
        ? selectRelevantContent(
            result.content,
            result.sourceQuery ?? query,
            maxChars,
            {
              title: result.title,
              verifiedPrice: result.product?.price,
              intent: options.intent,
            }
          )
        : '';
    const besideSnippet = select(
      snippet
        ? Math.max(MIN_SOURCE_EXCERPT_CHARS, budget - snippet.length - 1)
        : budget
    );
    const snippetKept =
      !!snippet &&
      (!besideSnippet || !snippetRepeatsExcerpt(snippet, besideSnippet));
    const relevant = !snippet || snippetKept ? besideSnippet : select(budget);
    const bodyPassage = relevant
      ? snippetKept
        ? `${relevant}\n${snippet}`
        : relevant
      : snippet;
    const rawPassage = `${formatVerifiedProduct(result.product)}${bodyPassage}`;
    const queryLabel =
      distinctQueries.size > 1 && result.sourceQuery
        ? `[Answers: ${result.sourceQuery}]\n`
        : '';
    const cleanPassage = neutralizeDelimiters(rawPassage);

    context.push(
      sourceBlock(startIndex + index, name, `${queryLabel}${cleanPassage}`)
    );

    sourceDocuments.push({
      kind: 'web',
      name,
      url: result.url,
      read: !!relevant,
      passage: cleanPassage,
      query: recordedQuery,
      ...(result.sourceQuery ? { sourceQuery: result.sourceQuery } : {}),
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
      query: recordedQuery,
      ...(result.sourceQuery ? { sourceQuery: result.sourceQuery } : {}),
    });
  }

  return { context, sourceDocuments };
};
