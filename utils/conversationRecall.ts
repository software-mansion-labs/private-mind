import type { LFMEmbeddings } from './lfmEmbeddings';
import { capChunksToTokenBudget } from './textChunking';
import { detectQuestionLanguage } from './questionLanguage';
import { stripCitations } from './citations';
import { stripThinkBlocks } from './thinking';
import { extractQueryTerms, foldForMatching, stemPrefix } from './queryTerms';
import { cosineSimilarity, reciprocalRankFusion } from './rankFusion';
import { estimatePromptTokens } from '../constants/context-window';
import {
  RECALL_BLOCK_HEADER,
  RECALL_EMBEDDING_CACHE_MAX,
  RECALL_EMBED_PER_TURN_CAP,
  RECALL_MAX_HITS,
  RECALL_MESSAGE_MAX_CHARS,
  RECALL_MIN_KEPT_SHARE,
  RECALL_MIN_LEXICAL_SCORE,
  RECALL_MIN_SIMILARITY,
  RECALL_SHARE_BY_WINDOW,
  RECALL_SPECIFIC_TERM_WEIGHT,
} from '../constants/conversation-memory';

export type RecallRole = 'user' | 'assistant';
export type RecallMode = 'none' | 'lexical' | 'fused';

export interface RecallCandidate {
  index: number;
  key?: number;
  role: RecallRole;
  text: string;
}

export interface RecalledMessage {
  index: number;
  role: RecallRole;
  text: string;
  rank: number;
  partner: boolean;
}

export interface RecallSelection {
  items: RecalledMessage[];
  mode: RecallMode;
}

export interface RecallInput {
  candidates: RecallCandidate[];
  question: string;
  similarities?: Map<number, number>;
  charRoom: number;
  tokenRoom: number;
}

interface WeightedTerm {
  stem: string;
  weight: number;
  numeric: boolean;
}

const NUMBER_TOKEN = /\d+/g;
const CAPITALISED_WORD = /\p{Lu}[\p{L}\p{N}]+/gu;
const SENTENCE_SPLIT = /(?<=[.!?\n])\s+|(?<=[।۔؟。！？])\s*/u;
const ELLIPSIS = '…';

export const recallShareFor = (windowTokens: number): number =>
  Math.min(
    RECALL_SHARE_BY_WINDOW.find((tier) => windowTokens >= tier.minWindowTokens)
      ?.share ?? 0,
    1 - RECALL_MIN_KEPT_SHARE
  );

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

const roleLabel = (role: RecallRole): string =>
  role === 'user' ? 'User' : 'Assistant';

const lineOf = (role: RecallRole, text: string): string =>
  `${roleLabel(role)}: ${text}`;

export const formatRecalledBlock = (items: RecalledMessage[]): string =>
  items.length === 0
    ? ''
    : `${RECALL_BLOCK_HEADER}${items
        .map((item) => lineOf(item.role, item.text))
        .join('\n')}`;

const partnerOf = (
  hit: RecallCandidate,
  byIndex: Map<number, RecallCandidate>
): RecallCandidate | undefined => {
  if (hit.role === 'user') {
    const reply = byIndex.get(hit.index + 1);
    return reply?.role === 'assistant' ? reply : undefined;
  }
  const question = byIndex.get(hit.index - 1);
  return question?.role === 'user' ? question : undefined;
};

export const selectRecalledMessages = ({
  candidates,
  question,
  similarities,
  charRoom,
  tokenRoom,
}: RecallInput): RecallSelection => {
  const none: RecallSelection = { items: [], mode: 'none' };
  const roomAfterHeader = charRoom - RECALL_BLOCK_HEADER.length;
  if (candidates.length === 0 || roomAfterHeader <= 0 || tokenRoom <= 0) {
    return none;
  }

  const terms = questionTermsFor(question);
  const scored = candidates.map((candidate) => {
    const window = bestWindow(candidate.text, terms);
    const similarity =
      candidate.key === undefined
        ? undefined
        : similarities?.get(candidate.key);
    return { candidate, window, similarity };
  });
  const usesEmbeddings = !!similarities && similarities.size > 0;

  const qualified = scored.filter(
    ({ window, similarity }) =>
      window.score >= RECALL_MIN_LEXICAL_SCORE ||
      (similarity !== undefined && similarity >= RECALL_MIN_SIMILARITY)
  );
  if (qualified.length === 0) return none;

  const newestFirst = (a: { candidate: RecallCandidate }, b: typeof a) =>
    b.candidate.index - a.candidate.index;
  const lexicalRanked = qualified
    .filter(({ window }) => window.score > 0)
    .sort((a, b) => b.window.score - a.window.score || newestFirst(a, b));
  const vectorRanked = qualified
    .filter(({ similarity }) => similarity !== undefined)
    .sort(
      (a, b) => (b.similarity ?? 0) - (a.similarity ?? 0) || newestFirst(a, b)
    );
  const fused = reciprocalRankFusion([
    { ids: lexicalRanked.map(({ candidate }) => String(candidate.index)) },
    { ids: vectorRanked.map(({ candidate }) => String(candidate.index)) },
  ]);
  const ranked = [...qualified].sort(
    (a, b) =>
      (fused.get(String(b.candidate.index)) ?? 0) -
        (fused.get(String(a.candidate.index)) ?? 0) || newestFirst(a, b)
  );

  const textByIndex = new Map(
    scored.map(({ candidate, window }) => [candidate.index, window.text])
  );
  const byIndex = new Map(
    candidates.map((candidate) => [candidate.index, candidate])
  );
  const chosen = new Map<number, RecalledMessage>();
  let charsLeft = roomAfterHeader;
  let tokensLeft = tokenRoom;

  const tryAdd = (
    candidate: RecallCandidate,
    rank: number,
    partner: boolean
  ): boolean => {
    if (chosen.has(candidate.index)) return false;
    const line = lineOf(
      candidate.role,
      textByIndex.get(candidate.index) ?? candidate.text
    );
    const chars = line.length + 1;
    const tokens = estimatePromptTokens(line);
    if (chars > charsLeft || tokens > tokensLeft) return false;
    charsLeft -= chars;
    tokensLeft -= tokens;
    chosen.set(candidate.index, {
      index: candidate.index,
      role: candidate.role,
      text: textByIndex.get(candidate.index) ?? candidate.text,
      rank,
      partner,
    });
    return true;
  };

  const hits: RecallCandidate[] = [];
  for (const { candidate } of ranked) {
    if (hits.length >= RECALL_MAX_HITS) break;
    if (tryAdd(candidate, hits.length, false)) hits.push(candidate);
  }
  hits.forEach((hit, rank) => {
    const partner = partnerOf(hit, byIndex);
    if (partner) tryAdd(partner, rank, true);
  });

  const items = [...chosen.values()].sort((a, b) => a.index - b.index);
  return items.length === 0
    ? none
    : { items, mode: usesEmbeddings ? 'fused' : 'lexical' };
};

export const withoutLeastRanked = (
  items: RecalledMessage[]
): RecalledMessage[] => {
  if (items.length === 0) return items;
  const worst = Math.max(...items.map((item) => item.rank));
  const partnerAt = items.findIndex(
    (item) => item.rank === worst && item.partner
  );
  const dropIndex =
    partnerAt >= 0 ? partnerAt : items.findIndex((item) => item.rank === worst);
  return items.filter((_, position) => position !== dropIndex);
};

export interface RecallEmbeddingEntry {
  contentLength: number;
  windows: number[][];
}

export interface RecallEmbeddingCache {
  get(id: number): RecallEmbeddingEntry | undefined;
  set(id: number, entry: RecallEmbeddingEntry): void;
  size(): number;
  clear(): void;
}

export const createRecallEmbeddingCache = (
  max: number = RECALL_EMBEDDING_CACHE_MAX
): RecallEmbeddingCache => {
  const store = new Map<number, RecallEmbeddingEntry>();
  return {
    get: (id) => store.get(id),
    set: (id, entry) => {
      if (store.size >= max && !store.has(id)) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(id, entry);
    },
    size: () => store.size,
    clear: () => store.clear(),
  };
};

const sessionRecallCache = createRecallEmbeddingCache();

export const resetRecallEmbeddingCache = () => sessionRecallCache.clear();

export interface RecallEmbedder {
  isLoaded(): boolean;
  embedQuery(text: string): Promise<number[]>;
  embedDocument(text: string): Promise<number[]>;
}

export interface EmbeddableMessage {
  id: number;
  role: string;
  content: string;
}

const recallTextOf = (message: EmbeddableMessage): string =>
  stripCitations(stripThinkBlocks(message.content)).trim();

const isRecallable = (message: EmbeddableMessage): boolean =>
  message.id > 0 &&
  (message.role === 'user' || message.role === 'assistant') &&
  recallTextOf(message).length > 0;

const contentChars = (messages: EmbeddableMessage[]): number =>
  messages.reduce((chars, message) => chars + message.content.length, 0);

export const recallEmbeddingPool = (
  messages: EmbeddableMessage[],
  conversationBudgetChars: number
): EmbeddableMessage[] => {
  if (contentChars(messages) <= conversationBudgetChars) return [];
  const surelyKeptChars = Math.floor(
    conversationBudgetChars * RECALL_MIN_KEPT_SHARE
  );
  let keptChars = 0;
  let keptFrom = messages.length;
  while (keptFrom > 0) {
    const next = keptChars + messages[keptFrom - 1]!.content.length;
    if (next > surelyKeptChars) break;
    keptChars = next;
    keptFrom -= 1;
  }
  return messages.slice(0, keptFrom);
};

export const embedConversationForRecall = async ({
  messages,
  question,
  embedder,
  cache = sessionRecallCache,
  perTurnCap = RECALL_EMBED_PER_TURN_CAP,
}: {
  messages: EmbeddableMessage[];
  question: string;
  embedder: RecallEmbedder | LFMEmbeddings | null;
  cache?: RecallEmbeddingCache;
  perTurnCap?: number;
}): Promise<Map<number, number> | null> => {
  if (!embedder || !embedder.isLoaded() || !question.trim()) return null;
  const candidates = messages.filter(isRecallable);
  if (candidates.length === 0) return null;

  try {
    const terms = questionTermsFor(question);
    const isCached = (message: EmbeddableMessage) =>
      cache.get(message.id)?.contentLength === recallTextOf(message).length;
    const pending = candidates.filter((message) => !isCached(message));
    const withOverlap = pending.filter(
      (message) => weightedCoverage(recallTextOf(message), terms) > 0
    );
    const rest = pending.filter((message) => !withOverlap.includes(message));
    for (const message of [...withOverlap, ...rest].slice(0, perTurnCap)) {
      const text = recallTextOf(message);
      const windows: number[][] = [];
      for (const piece of capChunksToTokenBudget([text])) {
        windows.push(await embedder.embedDocument(piece));
      }
      cache.set(message.id, { contentLength: text.length, windows });
    }

    const queryEmbedding = await embedder.embedQuery(question);
    const similarities = new Map<number, number>();
    for (const message of candidates) {
      const entry = cache.get(message.id);
      if (!entry) continue;
      similarities.set(
        message.id,
        Math.max(
          ...entry.windows.map((window) =>
            cosineSimilarity(queryEmbedding, window)
          )
        )
      );
    }
    return similarities.size > 0 ? similarities : null;
  } catch {
    return null;
  }
};
