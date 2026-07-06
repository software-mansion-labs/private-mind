import React, { createContext, useState, useEffect, useContext } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import {
  LFM_2_5_EMBEDDING_MODEL_ID,
  LFM_2_5_EMBEDDING_SOURCES,
} from '../constants/embedding-model';
import { migrateEmbeddingModelIfNeeded } from '../utils/embeddingModelMigration';
import { LFMEmbeddings } from '../utils/lfmEmbeddings';
import { ensureKeywordIndex } from '../database/keywordIndex';
import { isEmbeddingModelDownloaded } from '../utils/embeddingModel';
import { useEmbeddingModelStore } from '../store/embeddingModelStore';

const VectorStoreContext = createContext<{
  vectorStore: OPSQLiteVectorStore | null;
  embeddings: LFMEmbeddings | null;
}>({
  vectorStore: null,
  embeddings: null,
});

// Serializes init/teardown so overlapping effect runs don't race the shared DB.
let vectorStoreInitChain: Promise<unknown> = Promise.resolve();

export const VectorStoreProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [vectorStore, setVectorStore] = useState<OPSQLiteVectorStore | null>(
    null
  );
  const [embeddings, setEmbeddings] = useState<LFMEmbeddings | null>(null);
  const db = useSQLiteContext();

  useEffect(() => {
    let cancelled = false;
    let localStore: OPSQLiteVectorStore | null = null;

    const initialize = async () => {
      if (cancelled) return;
      try {
        const lfmEmbeddings = new LFMEmbeddings({
          modelSource: LFM_2_5_EMBEDDING_SOURCES.modelSource!,
          tokenizerSource: LFM_2_5_EMBEDDING_SOURCES.tokenizerSource!,
          onDownloadProgress: (progress) =>
            useEmbeddingModelStore.getState().setProgress(progress),
        });

        const store = new OPSQLiteVectorStore({
          name: 'private-mind-rag',
          embeddings: lfmEmbeddings,
        });
        localStore = store;

        await migrateEmbeddingModelIfNeeded(
          store,
          db,
          LFM_2_5_EMBEDDING_MODEL_ID
        );

        await ensureKeywordIndex(store.db);

        const downloaded = await isEmbeddingModelDownloaded();
        if (downloaded) {
          await store.load();
        }

        if (cancelled) {
          await store
            .unload()
            .catch((error) =>
              console.error('Failed to unload superseded vector store:', error)
            );
          return;
        }

        setVectorStore(store);
        setEmbeddings(lfmEmbeddings);
        if (downloaded) {
          useEmbeddingModelStore.getState().markReady();
        } else {
          useEmbeddingModelStore.getState().setStatus('not_downloaded');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to initialize vector store:', error);
        }
      }
    };

    vectorStoreInitChain = vectorStoreInitChain.then(initialize);

    return () => {
      cancelled = true;
      setVectorStore(null);
      setEmbeddings(null);
      useEmbeddingModelStore.getState().setStatus('unknown');
      vectorStoreInitChain = vectorStoreInitChain.then(() =>
        localStore
          ? localStore
              .unload()
              .catch((error) =>
                console.error('Failed to unload vector store:', error)
              )
          : undefined
      );
    };
  }, [db]);

  return (
    <VectorStoreContext.Provider value={{ vectorStore, embeddings }}>
      {children}
    </VectorStoreContext.Provider>
  );
};

export const useVectorStore = () => useContext(VectorStoreContext);
