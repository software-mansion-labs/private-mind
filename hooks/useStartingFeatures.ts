import { useEffect, useRef, useState } from 'react';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { useVectorStore } from '../context/VectorStoreContext';
import { useEmbeddingModelStore } from '../store/embeddingModelStore';
import { useLLMStore } from '../store/llmStore';
import { useSTTStore } from '../store/sttStore';
import { showNotEnoughStorage } from '../utils/storageSpace';
import { LFM_2_5_EMBEDDING_DOWNLOAD_SIZE_BYTES } from '../constants/embedding-model';
import {
  WHISPER_DOWNLOAD_SIZE_BYTES,
  isWhisperDownloaded,
} from '../utils/sttModelFiles';

const BYTES_PER_GB = 1_000_000_000;
const STORE_READY_TIMEOUT_MS = 15_000;
const STORE_POLL_MS = 100;

export type StartingFeatureKey = 'documents' | 'dictation';

export type StartingFeatureStatus = 'available' | 'downloading' | 'downloaded';

export interface StartingFeature {
  key: StartingFeatureKey;
  name: string;
  description: string;
  sizeGb: number;
  status: StartingFeatureStatus;
  progress: number;
}

export const STARTING_FEATURE_KEYS: StartingFeatureKey[] = [
  'documents',
  'dictation',
];

const waitForVectorStore = async (
  current: () => OPSQLiteVectorStore | null
) => {
  const deadline = Date.now() + STORE_READY_TIMEOUT_MS;
  while (!current() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, STORE_POLL_MS));
  }
  return current();
};

export const useStartingFeatures = () => {
  const { vectorStore, embeddings } = useVectorStore();
  const vectorStoreRef = useRef(vectorStore);
  vectorStoreRef.current = vectorStore;
  const embeddingsRef = useRef(embeddings);
  embeddingsRef.current = embeddings;

  const embeddingStatus = useEmbeddingModelStore((state) => state.status);
  const embeddingProgress = useEmbeddingModelStore((state) => state.progress);
  const speechReady = useSTTStore((state) => state.isReady);
  const fetchingSpeech = useSTTStore((state) => state.isFetchingFiles);
  const speechProgress = useSTTStore((state) => state.filesProgress);
  const [speechOnDisk, setSpeechOnDisk] = useState(false);

  useEffect(() => {
    let mounted = true;
    isWhisperDownloaded().then((downloaded) => {
      if (mounted && downloaded) setSpeechOnDisk(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const speechDownloaded = speechReady || speechOnDisk;

  const features: StartingFeature[] = [
    {
      key: 'documents',
      name: 'Documents & web search',
      description: 'Chat with files, search the web',
      sizeGb: LFM_2_5_EMBEDDING_DOWNLOAD_SIZE_BYTES / BYTES_PER_GB,
      status:
        embeddingStatus === 'ready'
          ? 'downloaded'
          : embeddingStatus === 'downloading'
            ? 'downloading'
            : 'available',
      progress: embeddingStatus === 'ready' ? 1 : embeddingProgress,
    },
    {
      key: 'dictation',
      name: 'Voice dictation',
      description: 'Speak instead of typing',
      sizeGb: WHISPER_DOWNLOAD_SIZE_BYTES / BYTES_PER_GB,
      status: speechDownloaded
        ? 'downloaded'
        : fetchingSpeech
          ? 'downloading'
          : 'available',
      progress: speechDownloaded ? 1 : speechProgress,
    },
  ];

  const downloadDocuments = async () => {
    const store = await waitForVectorStore(() => vectorStoreRef.current);
    if (!store) return false;
    const ready = await useEmbeddingModelStore
      .getState()
      .ensureReady(store, (load) =>
        useLLMStore.getState().runWithModelOffloaded(
          async () => {
            try {
              await load();
            } finally {
              await embeddingsRef.current?.unload();
            }
          },
          { restore: false }
        )
      );
    const storageFailure = useEmbeddingModelStore.getState().failedForStorage;
    if (!ready && storageFailure) {
      showNotEnoughStorage('Documents & web search', storageFailure.shortfall);
    }
    return ready;
  };

  const downloadDictation = async () => {
    const fetched = await useSTTStore.getState().fetchFiles();
    if (fetched) setSpeechOnDisk(true);
    return fetched;
  };

  const download = (key: StartingFeatureKey) =>
    key === 'documents' ? downloadDocuments() : downloadDictation();

  const cancel = (key: StartingFeatureKey) =>
    key === 'documents'
      ? useEmbeddingModelStore.getState().cancelDownload()
      : useSTTStore.getState().cancelFetchFiles();

  return { features, download, cancel };
};
