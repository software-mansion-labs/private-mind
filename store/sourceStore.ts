import { create } from 'zustand';
import {
  deleteSource,
  deleteSourceFromChats,
  getAllSources,
  insertSource,
  renameSource,
  Source,
} from '../database/sourcesRepository';
import { SQLiteDatabase } from 'expo-sqlite';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { RecursiveCharacterTextSplitter } from 'react-native-rag';
import { readPDF } from 'react-native-pdfium';
import { useLLMStore } from './llmStore';

interface SourceStore {
  sources: Source[];
  db: SQLiteDatabase | null;
  setDB: (db: SQLiteDatabase) => void;
  loadSources: () => Promise<void>;
  addSource: (
    source: Omit<Source, 'id'>,
    sourceUri: string,
    vectorStore: OPSQLiteVectorStore
  ) => Promise<{ success: boolean; isEmpty?: boolean }>;
  setSourceProcessing: (id: number, isProcessing: boolean) => void;
  deleteSource: (source: Source) => Promise<void>;
  renameSource: (id: number, newName: string) => Promise<void>;
}

const TEXT_SPLITTER_CHUNK_SIZE = 1000;
const TEXT_SPLITTER_CHUNK_OVERLAP = 100;

export const useSourceStore = create<SourceStore>((set, get) => ({
  sources: [],
  db: null,

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

  addSource: async (source, sourceUri, vectorStore) => {
    const db = get().db;
    if (!db) return { success: false };

    const normalizedUri = sourceUri.replace('file://', '');
    let sourceId: number | undefined;

    try {
      const sourceTextContent = await readPDF(normalizedUri);

      if (!sourceTextContent || sourceTextContent.trim().length === 0) {
        return { success: false, isEmpty: true };
      }

      // Add source to database immediately with processing state
      sourceId = await insertSource(db, source);
      if (!sourceId) {
        return { success: false };
      }

      // Add source to local state immediately with processing indicator
      const newSource: Source = {
        ...source,
        id: sourceId,
        isProcessing: true,
      };
      set((state) => ({
        sources: [...state.sources, newSource],
      }));

      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: TEXT_SPLITTER_CHUNK_SIZE,
        chunkOverlap: TEXT_SPLITTER_CHUNK_OVERLAP,
      });

      const chunks = await textSplitter.splitText(sourceTextContent);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        await vectorStore?.add(chunk, { documentId: sourceId });
      }

      // Remove processing state when done
      get().setSourceProcessing(sourceId, false);
      return { success: true };
    } catch (e) {
      console.error(e);
      // If vector processing fails, remove the source from database and local state
      if (sourceId) {
        try {
          await deleteSource(db, sourceId);
          set((state) => ({
            sources: state.sources.filter((s) => s.id !== sourceId),
          }));
        } catch (deleteError) {
          console.error(
            'Failed to cleanup source after vector processing error:',
            deleteError
          );
        }
      }
      return { success: false, isEmpty: true };
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
}));
