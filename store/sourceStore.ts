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
import { Platform } from 'react-native';
import { readPDF } from 'react-native-pdfium';

interface SourceStore {
  sources: Source[];
  db: SQLiteDatabase | null;
  setDB: (db: SQLiteDatabase) => void;
  loadSources: () => Promise<void>;
  addSource: (
    source: Omit<Source, 'id'>,
    sourceUri: string,
    vectorStore: OPSQLiteVectorStore
  ) => Promise<void>;
  deleteSource: (source: Source) => Promise<void>;
  renameSource: (id: number, newName: string) => Promise<void>;
}

export const useSourceStore = create<SourceStore>((set, get) => ({
  sources: [],
  db: null,

  setDB: (db) => {
    set({ db });
  },

  loadSources: async () => {
    const db = get().db;
    if (!db) return;

    const sources = await getAllSources(db);
    set({ sources });
  },

  addSource: async (source, sourceUri, vectorStore) => {
    const db = get().db;
    if (!db) return;

    const normalizedUri =
      Platform.OS === 'ios' ? sourceUri.replace('file://', '') : sourceUri;
    const sourceId = await insertSource(db, source);
    get().loadSources();

    if (sourceId) {
      const sourceTextContent = readPDF(normalizedUri);
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,
        chunkOverlap: 100,
      });

      const chunks = await textSplitter.splitText(sourceTextContent);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]!;
        await vectorStore?.add(chunk, { documentId: sourceId });
      }
    }
  },

  deleteSource: async (source: Source) => {
    const db = get().db;
    if (!db) return;

    await deleteSource(db, source.id);
    await deleteSourceFromChats(db, source);
    get().loadSources();
  },

  renameSource: async (id, newName) => {
    const db = get().db;
    if (!db) return;

    await renameSource(db, id, newName);
    get().loadSources();
  },
}));
