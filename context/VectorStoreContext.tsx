import React, { createContext, useState, useEffect, useContext } from 'react';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { ExecuTorchEmbeddings } from '@react-native-rag/executorch';
import {
  ALL_MINILM_L6_V2,
  ALL_MINILM_L6_V2_TOKENIZER,
} from 'react-native-executorch';

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
        const embeddings = new ExecuTorchEmbeddings({
          modelSource: ALL_MINILM_L6_V2,
          tokenizerSource: ALL_MINILM_L6_V2_TOKENIZER,
        });

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
