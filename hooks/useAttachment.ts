import { useState, useRef, useCallback, useEffect } from 'react';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import Toast from 'react-native-toast-message';
import { useSourceStore } from '../store/sourceStore';
import { useVectorStore } from '../context/VectorStoreContext';
import { useEmbeddingModelStore } from '../store/embeddingModelStore';
import { useLLMStore } from '../store/llmStore';
import { documentErrorMessage } from '../utils/documentErrorMessage';
import { extractArticle } from '../utils/web/url/extractArticle';
import { buildUrlSource } from '../utils/web/url/urlSource';
import { hostname } from '../utils/web/webResultsToContext';

export interface Attachment {
  id: string;
  type: 'image' | 'document';
  uri: string;
  name?: string;
  status: 'loading' | 'ready';
  sourceId?: number;
  progress?: number;
}

interface ClearAllOptions {
  cleanupSources?: boolean;
}

const IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'heic',
  'heif',
];

const isImageUri = (uri: string): boolean => {
  const pathPart = uri.split('?')[0].split('#')[0];
  const lastSegment = pathPart.split('/').pop() ?? '';
  const ext = lastSegment.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.includes(ext);
};

export const useAttachment = () => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const attachmentsRef = useRef<Attachment[]>([]);
  attachmentsRef.current = attachments;
  const attachmentRequestRef = useRef(0);
  const currentDocumentAttachmentIdRef = useRef<string | null>(null);
  const documentAbortRef = useRef<AbortController | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const attachmentSheetOpenRef = useRef(false);
  const embeddingDownloadSheetRef = useRef<BottomSheetModal>(null);
  const embeddingDownloadSheetOpenRef = useRef(false);
  const pendingDownloadSheetRef = useRef(false);
  const pendingDocumentPickRef = useRef(false);
  const { vectorStore, embeddings } = useVectorStore();
  const vectorStoreRef = useRef(vectorStore);
  vectorStoreRef.current = vectorStore;

  const sweepAbandonedSources = useCallback(() => {
    const store = vectorStoreRef.current;
    if (store) useSourceStore.getState().cleanupOrphanedSources(store);
  }, []);

  useEffect(() => {
    return () => {
      attachmentSheetOpenRef.current = false;
      embeddingDownloadSheetOpenRef.current = false;
      pendingDownloadSheetRef.current = false;
      pendingDocumentPickRef.current = false;
      pendingUrlRef.current = null;
      if (attachmentsRef.current.some((a) => a.sourceId)) {
        sweepAbandonedSources();
      }
    };
  }, [sweepAbandonedSources]);

  const replaceWithImage = useCallback((uri: string) => {
    currentDocumentAttachmentIdRef.current = null;
    setAttachments([
      { id: `img-${Date.now()}`, type: 'image', uri, status: 'ready' },
    ]);
  }, []);

  const pickFromLibrary = useCallback(async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 1 });
    if (!result.didCancel && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      if (uri) {
        replaceWithImage(uri);
      }
    }
  }, [replaceWithImage]);

  const pickFromCamera = useCallback(async () => {
    const result = await launchCamera({ mediaType: 'photo', quality: 1 });
    if (!result.didCancel && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      if (uri) {
        replaceWithImage(uri);
      }
    }
  }, [replaceWithImage]);

  const runDocumentPicker = useCallback(async () => {
    const pickedFileResult = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'text/plain',
        'text/markdown',
        'text/x-markdown',
        'text/html',
        'text/csv',
        'text/comma-separated-values',
        'application/csv',
      ],
      copyToCacheDirectory: true,
    });

    if (pickedFileResult.canceled || !pickedFileResult.assets[0]) return;

    const asset = pickedFileResult.assets[0];
    const extFromName = asset.name?.includes('.')
      ? asset.name.split('.').pop()
      : undefined;
    const fileType = (
      extFromName ||
      asset.uri.split('.').pop() ||
      ''
    ).toLowerCase();
    const fileName =
      asset.name?.split('.')[0] ||
      asset.uri.split('/').pop()?.split('.')[0] ||
      'Unnamed';
    const attachmentId = `doc-${Date.now()}`;
    const requestId = attachmentRequestRef.current + 1;
    attachmentRequestRef.current = requestId;
    currentDocumentAttachmentIdRef.current = attachmentId;

    documentAbortRef.current?.abort();
    const abortController = new AbortController();
    documentAbortRef.current = abortController;

    setAttachments([
      {
        id: attachmentId,
        type: 'document',
        uri: asset.uri,
        name: asset.name || fileName,
        status: 'loading',
      },
    ]);

    try {
      const newSource = {
        name: asset.name || fileName,
        type: fileType,
        size: asset.size || null,
      };
      const { addSource } = useSourceStore.getState();
      let lastPercent = -1;
      const handleProgress = (progress: number) => {
        const percent = Math.round(progress * 100);
        if (percent === lastPercent) return;
        lastPercent = percent;
        if (
          attachmentRequestRef.current !== requestId ||
          currentDocumentAttachmentIdRef.current !== attachmentId
        ) {
          return;
        }
        setAttachments((prev) =>
          prev.map((a) => (a.id === attachmentId ? { ...a, progress } : a))
        );
      };
      const addDocumentSource = () =>
        addSource(
          newSource,
          asset.uri,
          vectorStore!,
          embeddings,
          handleProgress,
          abortController.signal
        );
      const indexDocumentSource = () =>
        embeddings
          ? useLLMStore
              .getState()
              .runWithModelOffloaded(
                () => embeddings.runWithLoadedModel(addDocumentSource),
                { restore: false }
              )
          : addDocumentSource();
      const result = await indexDocumentSource();
      if (result.cancelled) return;
      const isCurrentDocumentRequest =
        attachmentRequestRef.current === requestId &&
        currentDocumentAttachmentIdRef.current === attachmentId;

      if (result.success) {
        if (!isCurrentDocumentRequest) {
          console.warn('Ignoring stale document processing result', {
            attachmentId,
            sourceId: result.sourceId,
            name: newSource.name,
          });
          return;
        }

        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachmentId
              ? { ...a, status: 'ready', sourceId: result.sourceId }
              : a
          )
        );
        if (result.truncated) {
          Toast.show({
            type: 'defaultToast',
            text1:
              'This document is large — only the first part was indexed for search.',
          });
        }
      } else {
        if (!isCurrentDocumentRequest) return;

        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
        Toast.show({
          type: 'defaultToast',
          text1: documentErrorMessage(result),
        });
      }
    } catch (error) {
      console.error('Document attachment processing threw', {
        attachmentId,
        requestId,
        name: asset.name || fileName,
        error,
      });
      if (attachmentRequestRef.current !== requestId) return;

      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      Toast.show({
        type: 'defaultToast',
        text1: 'Error reading document.',
      });
    }
  }, [vectorStore, embeddings]);

  const runUrlSource = useCallback(
    async (url: string) => {
      const attachmentId = `url-${Date.now()}`;
      const requestId = attachmentRequestRef.current + 1;
      attachmentRequestRef.current = requestId;
      currentDocumentAttachmentIdRef.current = attachmentId;

      documentAbortRef.current?.abort();
      const abortController = new AbortController();
      documentAbortRef.current = abortController;

      const isCurrentRequest = () =>
        attachmentRequestRef.current === requestId &&
        currentDocumentAttachmentIdRef.current === attachmentId;

      const domain = hostname(url);
      setAttachments([
        {
          id: attachmentId,
          type: 'document',
          uri: url,
          name: domain,
          status: 'loading',
        },
      ]);

      try {
        const article = await extractArticle(url);
        if (abortController.signal.aborted || !isCurrentRequest()) return;

        if (!article.text || article.text.trim().length === 0) {
          setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
          Toast.show({
            type: 'defaultToast',
            text1: 'Could not read this page.',
          });
          return;
        }

        const displayName = article.title?.trim() || domain;
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachmentId ? { ...a, name: displayName } : a
          )
        );

        const { addSource } = useSourceStore.getState();
        let lastPercent = -1;
        const handleProgress = (progress: number) => {
          const percent = Math.round(progress * 100);
          if (percent === lastPercent) return;
          lastPercent = percent;
          if (!isCurrentRequest()) return;
          setAttachments((prev) =>
            prev.map((a) => (a.id === attachmentId ? { ...a, progress } : a))
          );
        };

        const result = await addSource(
          buildUrlSource(url, article),
          url,
          vectorStore!,
          embeddings,
          handleProgress,
          abortController.signal,
          article.text
        );

        if (result.cancelled) return;
        if (result.success) {
          if (!isCurrentRequest()) return;
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachmentId
                ? { ...a, status: 'ready', sourceId: result.sourceId }
                : a
            )
          );
          if (result.truncated) {
            Toast.show({
              type: 'defaultToast',
              text1:
                'This page is large — only the first part was indexed for search.',
            });
          }
        } else {
          if (!isCurrentRequest()) return;
          setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
          Toast.show({
            type: 'defaultToast',
            text1: documentErrorMessage(result),
          });
        }
      } catch (error) {
        console.error('URL source processing threw', {
          attachmentId,
          url,
          error,
        });
        if (attachmentRequestRef.current !== requestId) return;
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
        Toast.show({
          type: 'defaultToast',
          text1: 'Error reading link.',
        });
      }
    },
    [vectorStore, embeddings]
  );

  const presentDownloadSheet = useCallback(() => {
    embeddingDownloadSheetOpenRef.current = true;
    embeddingDownloadSheetRef.current?.present();
  }, []);

  const markDownloadSheetClosed = useCallback(() => {
    embeddingDownloadSheetOpenRef.current = false;
    if (!pendingDocumentPickRef.current) return;
    pendingDocumentPickRef.current = false;
    const pendingUrl = pendingUrlRef.current;
    pendingUrlRef.current = null;
    const resumed = pendingUrl ? runUrlSource(pendingUrl) : runDocumentPicker();
    resumed.catch((error) => {
      console.error('Failed to resume the attachment after download', error);
    });
  }, [runDocumentPicker, runUrlSource]);

  const markAttachmentSheetClosed = useCallback(() => {
    attachmentSheetOpenRef.current = false;
    if (!pendingDownloadSheetRef.current) return;
    pendingDownloadSheetRef.current = false;
    presentDownloadSheet();
  }, [presentDownloadSheet]);

  const pickDocument = useCallback(async () => {
    if (useEmbeddingModelStore.getState().status === 'ready') {
      return runDocumentPicker();
    }
    if (attachmentSheetOpenRef.current) {
      pendingDownloadSheetRef.current = true;
      sheetRef.current?.dismiss();
      return;
    }
    presentDownloadSheet();
  }, [runDocumentPicker, presentDownloadSheet]);

  const addUrlSource = useCallback(
    async (url: string) => {
      if (useEmbeddingModelStore.getState().status === 'ready') {
        return runUrlSource(url);
      }
      pendingUrlRef.current = url;
      presentDownloadSheet();
    },
    [runUrlSource, presentDownloadSheet]
  );

  const downloadModelAndContinue = useCallback(async () => {
    if (!vectorStore) return;
    const ready = await useLLMStore.getState().runWithModelOffloaded(
      async () => {
        const loaded = await useEmbeddingModelStore
          .getState()
          .ensureReady(vectorStore);
        await embeddings?.unload();
        return loaded;
      },
      { restore: false }
    );
    if (!ready) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Failed to download the document model.',
      });
      return;
    }
    if (!embeddingDownloadSheetOpenRef.current) return;
    pendingDocumentPickRef.current = true;
    embeddingDownloadSheetRef.current?.dismiss();
  }, [vectorStore, embeddings]);

  const removeAttachment = useCallback(
    (id: string) => {
      if (currentDocumentAttachmentIdRef.current === id) {
        currentDocumentAttachmentIdRef.current = null;
        documentAbortRef.current?.abort();
      }
      const removed = attachmentsRef.current.find((a) => a.id === id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      if (removed?.sourceId) sweepAbandonedSources();
    },
    [sweepAbandonedSources]
  );

  const clearAll = useCallback(
    (options: ClearAllOptions = {}) => {
      const cleanupSources = options.cleanupSources ?? false;
      const hadDocuments = attachmentsRef.current.some((a) => a.sourceId);
      currentDocumentAttachmentIdRef.current = null;
      documentAbortRef.current?.abort();
      setAttachments([]);
      if (cleanupSources && hadDocuments) {
        sweepAbandonedSources();
      }
    },
    [sweepAbandonedSources]
  );

  const openSheet = useCallback(() => {
    attachmentSheetOpenRef.current = true;
    sheetRef.current?.present();
  }, []);

  const addPastedAttachment = useCallback(
    (uri: string) => {
      if (!uri || typeof uri !== 'string') {
        return;
      }

      if (!isImageUri(uri)) {
        Toast.show({
          type: 'defaultToast',
          text1: 'Only images can be pasted. Use the + button for documents.',
        });
        return;
      }

      replaceWithImage(uri);
    },
    [replaceWithImage]
  );

  return {
    attachments,
    sheetRef,
    embeddingDownloadSheetRef,
    presentDownloadSheet,
    pickFromLibrary,
    pickFromCamera,
    pickDocument,
    addUrlSource,
    downloadModelAndContinue,
    markDownloadSheetClosed,
    markAttachmentSheetClosed,
    removeAttachment,
    clearAll,
    openSheet,
    addPastedAttachment,
  };
};
