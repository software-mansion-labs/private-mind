import type { LFMEmbeddings } from '../lfmEmbeddings';
import { capChunksToTokenBudget } from '../textChunking';
import { stripCitations } from '../citations';
import { stripThinkBlocks } from '../thinking';
import { cosineSimilarity } from '../rankFusion';
import {
  RECALL_EMBEDDING_CACHE_MAX,
  RECALL_EMBED_PER_TURN_CAP,
  RECALL_MIN_KEPT_SHARE,
} from '../../constants/conversation-memory';
import { questionTermsFor, weightedCoverage } from './recallTerms';

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
