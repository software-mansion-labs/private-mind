import React, { createContext, useState, useEffect, useContext } from 'react';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { ExecuTorchEmbeddings } from '@react-native-rag/executorch';
import { getModelConfig, ALL_MINI_LM_MODEL } from '../utils/modelConfig';

const getAllMiniLMAssets = async () => {
  const config = await getModelConfig(ALL_MINI_LM_MODEL);

  return {
    modelSource: config.modelSource!,
    tokenizerSource: config.tokenizerSource!,
  };
};

const VectorStoreContext = createContext<{
  vectorStore: OPSQLiteVectorStore | null;
}>({
  vectorStore: null,
});

export const VectorStoreProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [vectorStore, setVectorStore] = useState<OPSQLiteVectorStore | null>(
    null
  );

  useEffect(() => {
    const initialize = async () => {
      try {
        const assets = await getAllMiniLMAssets();
        const embeddings = new ExecuTorchEmbeddings(assets);

        const store = new OPSQLiteVectorStore({
          name: 'private-mind-rag',
          embeddings,
        });

        // Migrate: drop stale vectors table from older schema versions
        // that lacks the `document` column. Users will need to re-add documents.
        try {
          await store.db.execute("SELECT document FROM vectors LIMIT 0");
        } catch {
          await store.db.execute("DROP TABLE IF EXISTS vectors");
        }

        await store.load();

        setVectorStore(store);
      } catch (error) {
        console.error('Failed to initialize vector store:', error);
      }
    };

    initialize();

    return () => {
      setVectorStore(null);
    };
  }, []);

  return (
    <VectorStoreContext.Provider value={{ vectorStore }}>
      {children}
    </VectorStoreContext.Provider>
  );
};

export const useVectorStore = () => useContext(VectorStoreContext);
