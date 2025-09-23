import React, { createContext, useState, useEffect, useContext } from 'react';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { ExecuTorchEmbeddings } from '@react-native-rag/executorch';

const ALL_MINILM_L6_V2_ASSETS = {
  modelSource: require('../assets/models/all-minilm-l6-v2/all-MiniLM-L6-v2_xnnpack.pte'),
  tokenizerSource: require('../assets/models/all-minilm-l6-v2/tokenizer.json'),
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
        const embeddings = new ExecuTorchEmbeddings(ALL_MINILM_L6_V2_ASSETS);

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
