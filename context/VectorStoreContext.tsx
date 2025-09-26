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

        const store = await new OPSQLiteVectorStore({
          name: 'private-mind-rag',
          embeddings,
        }).load();

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
