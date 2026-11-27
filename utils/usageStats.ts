import { estimatePromptTokens } from '../constants/context-window';

export const TOKENS_PER_A4_PAGE = 650;
export const PAGE_MILESTONES = [10, 100, 1000] as const;
export const APPROXIMATE_SHARE_LIMIT = 0.1;
export const MIN_TOKENS_FOR_SPEED_RECORD = 32;

const IDEOGRAPH = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const WORD_RUN = /\S+/g;
const PUNCTUATION_ONLY = /^[!-/:-@[-`{-~\u2010-\u2027\u2030-\u205e]+$/;

export const countWords = (text: string): number => {
  const ideographs = text.match(IDEOGRAPH)?.length ?? 0;
  const runs = text.replace(IDEOGRAPH, ' ').match(WORD_RUN) ?? [];
  return ideographs + runs.filter((run) => !PUNCTUATION_ONLY.test(run)).length;
};

export const tokensToPages = (tokens: number): number =>
  Math.max(0, tokens) / TOKENS_PER_A4_PAGE;

export interface UsageTotals {
  countedTokens: number;
  countedWords: number;
  countedAnswers: number;
  estimatedTokens: number;
  estimatedWords: number;
  estimatedAnswers: number;
  chats: number;
  bestTokensPerSecond: number;
  bestTokensPerSecondModel: string | null;
  mostUsedModel: string | null;
  milestonePagesShown: number;
}

export const EMPTY_USAGE_TOTALS: UsageTotals = {
  countedTokens: 0,
  countedWords: 0,
  countedAnswers: 0,
  estimatedTokens: 0,
  estimatedWords: 0,
  estimatedAnswers: 0,
  chats: 0,
  bestTokensPerSecond: 0,
  bestTokensPerSecondModel: null,
  mostUsedModel: null,
  milestonePagesShown: 0,
};

export interface UsageSummary {
  tokens: number;
  words: number;
  answers: number;
  chats: number;
  pages: number;
  approximate: boolean;
  mostUsedModel: string | null;
  bestTokensPerSecond: number;
  bestTokensPerSecondModel: string | null;
}

export const backfillDominates = (totals: UsageTotals): boolean => {
  const tokens = totals.countedTokens + totals.estimatedTokens;
  return (
    totals.estimatedTokens > 0 &&
    totals.estimatedTokens > tokens * APPROXIMATE_SHARE_LIMIT
  );
};

export const summarizeUsage = (totals: UsageTotals): UsageSummary => {
  const tokens = totals.countedTokens + totals.estimatedTokens;
  return {
    tokens,
    words: totals.countedWords + totals.estimatedWords,
    answers: totals.countedAnswers + totals.estimatedAnswers,
    chats: totals.chats,
    pages: tokensToPages(tokens),
    approximate: backfillDominates(totals),
    mostUsedModel: totals.mostUsedModel,
    bestTokensPerSecond: totals.bestTokensPerSecond,
    bestTokensPerSecondModel: totals.bestTokensPerSecondModel,
  };
};

export interface StoredAnswer {
  chatId: number;
  content: string | null;
  modelName: string | null;
  tokensPerSecond: number | null;
}

export interface ModelTally {
  answers: number;
  tokens: number;
}

export interface UsageBackfill {
  tokens: number;
  words: number;
  answers: number;
  chats: number;
  models: Record<string, ModelTally>;
  bestTokensPerSecond: number;
  bestTokensPerSecondModel: string | null;
}

export const estimateBackfill = (answers: StoredAnswer[]): UsageBackfill => {
  const chats = new Set<number>();
  const models: Record<string, ModelTally> = {};
  let tokens = 0;
  let words = 0;
  let counted = 0;
  let bestTokensPerSecond = 0;
  let bestTokensPerSecondModel: string | null = null;

  for (const answer of answers) {
    const text = answer.content ?? '';
    if (!text.trim()) continue;
    const answerTokens = estimatePromptTokens(text);
    tokens += answerTokens;
    words += countWords(text);
    counted += 1;
    chats.add(answer.chatId);
    const modelName = answer.modelName?.trim();
    if (modelName) {
      const tally = models[modelName] ?? { answers: 0, tokens: 0 };
      models[modelName] = {
        answers: tally.answers + 1,
        tokens: tally.tokens + answerTokens,
      };
    }
    const speed = answer.tokensPerSecond ?? 0;
    if (
      answerTokens >= MIN_TOKENS_FOR_SPEED_RECORD &&
      speed > bestTokensPerSecond
    ) {
      bestTokensPerSecond = speed;
      bestTokensPerSecondModel = modelName || null;
    }
  }

  return {
    tokens,
    words,
    answers: counted,
    chats: chats.size,
    models,
    bestTokensPerSecond,
    bestTokensPerSecondModel,
  };
};

export const milestoneToOffer = (
  pages: number,
  milestonePagesShown: number
): number | null => {
  const reached = PAGE_MILESTONES.filter(
    (milestone) => pages >= milestone && milestone > milestonePagesShown
  );
  return reached.length > 0 ? reached[reached.length - 1] : null;
};

const GROUPED_THOUSANDS = /\B(?=(\d{3})+(?!\d))/g;
const FRACTIONAL_PAGES_BELOW = 10;

export const formatCount = (value: number): string =>
  String(Math.round(value)).replace(GROUPED_THOUSANDS, ',');

export const formatPages = (pages: number): string => {
  if (pages < FRACTIONAL_PAGES_BELOW) {
    const tenths = Math.floor(pages * 10) / 10;
    return tenths % 1 === 0 ? String(tenths) : tenths.toFixed(1);
  }
  return formatCount(Math.floor(pages));
};

export const pagesUnit = (pages: number): string =>
  pages === 1 ? 'A4 page' : 'A4 pages';

export const pagesLabel = (pages: number): string =>
  `${formatPages(pages)} ${pagesUnit(pages)}`;

export const approximately = (text: string, approximate: boolean): string =>
  approximate ? `about ${text}` : text;
