import { create } from 'zustand';
import {
  deleteSource,
  deleteSourceFromChats,
  findMatchingSource,
  getAllSources,
  getOrphanedSources,
  insertSource,
  renameSource,
  Source,
} from '../database/sourcesRepository';
import { SQLiteDatabase } from 'expo-sqlite';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { RecursiveCharacterTextSplitter } from 'react-native-rag';
import { readDocumentText } from '../utils/fileReaders';
import { useLLMStore } from './llmStore';
import { LFMEmbeddings } from '../utils/lfmEmbeddings';
import {
  addChunkToKeywordIndex,
  storedChunkTexts,
  removeDocumentFromKeywordIndex,
} from '../database/keywordIndex';
import {
  MAX_SOURCE_CHUNKS,
  MAX_SOURCE_TEXT_CHARS,
} from '../constants/retrieval';
import {
  capChunksToTokenBudget,
  getChunkCharOverlap,
  getChunkCharSize,
} from '../utils/textChunking';

interface SourceStore {
  sources: Source[];
  db: SQLiteDatabase | null;
  isReading: boolean;
  setDB: (db: SQLiteDatabase) => void;
  loadSources: () => Promise<void>;
  addSource: (
    source: Omit<Source, 'id'>,
    sourceUri: string,
    vectorStore: OPSQLiteVectorStore,
    embeddings?: LFMEmbeddings | null,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
    preReadText?: string
  ) => Promise<{
    success: boolean;
    isEmpty?: boolean;
    reason?: 'scanned_pdf';
    sourceId?: number;
    cancelled?: boolean;
    truncated?: boolean;
  }>;
  setSourceProcessing: (id: number, isProcessing: boolean) => void;
  deleteSource: (source: Source) => Promise<void>;
  renameSource: (id: number, newName: string) => Promise<void>;
  cleanupOrphanedSources: (vectorStore: OPSQLiteVectorStore) => Promise<void>;
  holdSources: (sourceIds: number[]) => () => void;
  registerComposer: (heldByComposer: () => number[]) => () => void;
}

const sourceHolds = new Map<number, number>();
const composers = new Set<() => number[]>();

const holdSourceIds = (sourceIds: number[]) => {
  sourceIds.forEach((id) =>
    sourceHolds.set(id, (sourceHolds.get(id) ?? 0) + 1)
  );
  let released = false;
  return () => {
    if (released) return;
    released = true;
    sourceIds.forEach((id) => {
      const holds = (sourceHolds.get(id) ?? 1) - 1;
      if (holds > 0) sourceHolds.set(id, holds);
      else sourceHolds.delete(id);
    });
  };
};

const isHeld = (sourceId: number) =>
  sourceHolds.has(sourceId) ||
  [...composers].some((heldByComposer) => heldByComposer().includes(sourceId));

export const useSourceStore = create<SourceStore>((set, get) => ({
  sources: [],
  db: null,
  isReading: false,

  setDB: (db) => {
    set({ db });
  },

  loadSources: async () => {
    const db = get().db;
    if (!db) return;
    try {
      const sources = await getAllSources(db);
      set({ sources });
    } catch (e) {
      console.error(e);
    }
  },

  addSource: async (
    source,
    sourceUri,
    vectorStore,
    embeddings,
    onProgress,
    signal,
    preReadText
  ) => {
    const db = get().db;
    if (!db) return { success: false };

    const tempId = -Date.now();
    set({ isReading: true });
    let rollbackPartialSource: (() => Promise<void>) | null = null;
    let releaseHold = () => {};

    try {
      const sourceTextContent =
        preReadText ?? (await readDocumentText(sourceUri, source.type));

      if (!sourceTextContent || sourceTextContent.trim().length === 0) {
        const isScannedPdf = source.type.toLowerCase() === 'pdf';
        return {
          success: false,
          isEmpty: true,
          ...(isScannedPdf ? { reason: 'scanned_pdf' as const } : {}),
        };
      }

      const tempSource: Source = { ...source, id: tempId, isProcessing: true };
      set((state) => ({ sources: [...state.sources, tempSource] }));

      const cappedText =
        sourceTextContent.length > MAX_SOURCE_TEXT_CHARS
          ? sourceTextContent.slice(0, MAX_SOURCE_TEXT_CHARS)
          : sourceTextContent;

      const chunkSize = getChunkCharSize(cappedText);
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap: getChunkCharOverlap(chunkSize),
      });
      const allChunks = capChunksToTokenBudget(
        await textSplitter.splitText(cappedText)
      );
      const truncated =
        cappedText.length < sourceTextContent.length ||
        allChunks.length > MAX_SOURCE_CHUNKS;
      const chunks = truncated
        ? allChunks.slice(0, MAX_SOURCE_CHUNKS)
        : allChunks;

      const matchingSource = await findMatchingSource(db, {
        type: source.type,
        size: source.size,
        firstChunk: chunks[0] || undefined,
      });
      if (matchingSource) {
        releaseHold = holdSourceIds([matchingSource.id]);
      }
      const storedChunks = matchingSource
        ? await storedChunkTexts(vectorStore?.db, matchingSource.id)
        : null;
      const matchHoldsThisText =
        storedChunks === null ||
        storedChunks.every((text, index) => text === chunks[index]);
      const matchIsComplete =
        storedChunks === null ||
        (matchHoldsThisText && storedChunks.length === chunks.length);
      if (matchingSource && matchIsComplete) {
        onProgress?.(1);
        set((state) => {
          const withoutTemporary = state.sources.filter(
            (item) => item.id !== tempId
          );
          return {
            sources: withoutTemporary.some(
              (item) => item.id === matchingSource.id
            )
              ? withoutTemporary
              : [...withoutTemporary, matchingSource],
          };
        });
        return {
          success: true,
          sourceId: matchingSource.id,
          truncated,
        };
      }

      const removeStoredChunks = async (id: number) => {
        if (!vectorStore) return;
        await vectorStore.delete({
          predicate: (value) => value.metadata?.documentId === id,
        });
        await removeDocumentFromKeywordIndex(vectorStore.db, id);
      };

      const repairedSourceId =
        matchingSource && matchHoldsThisText ? matchingSource.id : null;
      if (repairedSourceId !== null) {
        await removeStoredChunks(repairedSourceId);
      }
      const sourceId =
        repairedSourceId ??
        (await insertSource(db, {
          ...source,
          firstChunk: chunks[0] || undefined,
        }));
      if (!sourceId) {
        set((state) => ({
          sources: state.sources.filter((s) => s.id !== tempId),
        }));
        return { success: false };
      }
      if (repairedSourceId === null) {
        releaseHold = holdSourceIds([sourceId]);
      }

      rollbackPartialSource = async () => {
        await removeStoredChunks(sourceId);
        if (repairedSourceId === null) await deleteSource(db, sourceId);
        set((state) => ({
          sources: state.sources.filter((s) => s.id !== tempId),
        }));
      };

      onProgress?.(0);
      for (let i = 0; i < chunks.length; i++) {
        if (signal?.aborted) {
          await rollbackPartialSource();
          return { success: false, cancelled: true };
        }
        const embedding = embeddings
          ? await embeddings.embedDocument(chunks[i]!)
          : undefined;
        const chunkId = `${sourceId}:${i}`;
        await vectorStore?.add({
          id: chunkId,
          document: chunks[i]!,
          embedding,
          metadata: {
            documentId: sourceId,
            name: source.name,
            chunkIndex: i,
            isFirstChunk: i === 0,
          },
        });
        if (vectorStore) {
          await addChunkToKeywordIndex(
            vectorStore.db,
            chunkId,
            sourceId,
            chunks[i]!
          );
        }
        onProgress?.((i + 1) / chunks.length);
      }

      set((state) => ({
        sources: state.sources
          .filter((s) => s.id !== sourceId)
          .map((s) =>
            s.id === tempId
              ? {
                  ...s,
                  id: sourceId,
                  isProcessing: false,
                  firstChunk: chunks[0],
                }
              : s
          ),
      }));
      return { success: true, sourceId, truncated };
    } catch (e) {
      console.error(e);
      try {
        await rollbackPartialSource?.();
      } catch (rollbackError) {
        console.error(rollbackError);
      }
      set((state) => ({
        sources: state.sources.filter((s) => s.id !== tempId),
      }));
      return { success: false };
    } finally {
      releaseHold();
      set({ isReading: false });
    }
  },

  setSourceProcessing: (id, isProcessing) => {
    set((state) => ({
      sources: state.sources.map((source) =>
        source.id === id ? { ...source, isProcessing } : source
      ),
    }));
  },

  deleteSource: async (source: Source) => {
    const db = get().db;
    if (!db) return;
    try {
      await deleteSource(db, source.id);
      await deleteSourceFromChats(db, source);
    } catch (e) {
      console.error(e);
    }
    get().loadSources();

    useLLMStore.getState().refreshActiveChatMessages();
  },

  renameSource: async (id, newName) => {
    const db = get().db;
    if (!db) return;
    try {
      await renameSource(db, id, newName);
    } catch (e) {
      console.error(e);
    }
    get().loadSources();
  },

  cleanupOrphanedSources: async (vectorStore) => {
    const db = get().db;
    if (!db) return;
    try {
      const orphaned = (await getOrphanedSources(db)).filter(
        (source) => !isHeld(source.id)
      );
      for (const source of orphaned) {
        if (isHeld(source.id)) continue;
        await vectorStore.delete({
          predicate: (value) => value.metadata?.documentId === source.id,
        });
        await removeDocumentFromKeywordIndex(vectorStore.db, source.id);
        if (isHeld(source.id)) continue;
        await deleteSource(db, source.id);
      }
      if (orphaned.length > 0) {
        get().loadSources();
      }
    } catch (e) {
      console.error(e);
    }
  },

  holdSources: holdSourceIds,

  registerComposer: (heldByComposer) => {
    composers.add(heldByComposer);
    return () => {
      composers.delete(heldByComposer);
    };
  },
}));
