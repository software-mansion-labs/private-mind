import { useState, useRef, useCallback, useEffect } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import Toast from 'react-native-toast-message';
import { useSourceStore } from '../store/sourceStore';
import { useVectorStore } from '../context/VectorStoreContext';
import { useEmbeddingModelStore } from '../store/embeddingModelStore';
import { useLLMStore } from '../store/llmStore';
import { documentErrorMessage } from '../utils/documentErrorMessage';
import { extractArticle } from '../utils/web/url/extractArticle';
import { buildUrlSource } from '../utils/web/url/urlSource';
import { hostname } from '../utils/web/hostname';

export type DownloadResume = 'attachment' | 'none';

export type DocumentPickOutcome = 'picked' | 'canceled';

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

export interface LibraryImage {
  id: string;
  uri: string;
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

export const MAX_IMAGE_ATTACHMENTS = 1;

const RESOLVE_TIMEOUT_MS = 15000;

const STORE_SETTLE_TIMEOUT_MS = 6000;
const STORE_READY_TIMEOUT_MS = 15000;

const withTimeout = async <T>(work: Promise<T>) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), RESOLVE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

type ResolvedPhoto =
  | { uri: string }
  | { uri: null; inCloud: true }
  | { uri: null; inCloud: false };

const resolveLibraryUri = async (
  photo: LibraryImage
): Promise<ResolvedPhoto> => {
  if (!photo.uri.startsWith('ph://')) return { uri: photo.uri };
  try {
    const local = await withTimeout(
      MediaLibrary.getAssetInfoAsync(photo.id, {
        shouldDownloadFromNetwork: false,
      })
    );
    if (local?.localUri) return { uri: local.localUri };
    const inCloud = !!local?.isNetworkAsset;

    const fetched = await withTimeout(
      MediaLibrary.getAssetInfoAsync(photo.id, {
        shouldDownloadFromNetwork: true,
      })
    );
    if (fetched?.localUri) return { uri: fetched.localUri };
    return { uri: null, inCloud };
  } catch (error) {
    console.error('Failed to resolve a library asset to a local file', error);
    return { uri: null, inCloud: false };
  }
};

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
  const panelOpenRef = useRef(false);
  const pickerClosedRef = useRef<
    ((outcome: DocumentPickOutcome) => void) | null
  >(null);
  const pendingUrlRef = useRef<string | null>(null);
  const embeddingDownloadSheetRef = useRef<BottomSheetModal>(null);
  const embeddingDownloadSheetOpenRef = useRef(false);
  const downloadResumeRef = useRef<DownloadResume>('attachment');
  const pendingDownloadSheetRef = useRef(false);
  const pendingDocumentPickRef = useRef(false);
  const { vectorStore, embeddings } = useVectorStore();
  const vectorStoreRef = useRef(vectorStore);
  vectorStoreRef.current = vectorStore;
  const embeddingsRef = useRef(embeddings);
  embeddingsRef.current = embeddings;

  const awaitVectorStore = useCallback(async (timeoutMs: number) => {
    const deadline = Date.now() + timeoutMs;
    while (!vectorStoreRef.current && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return vectorStoreRef.current;
  }, []);

  const sweepAbandonedSources = useCallback(() => {
    const store = vectorStoreRef.current;
    if (store) useSourceStore.getState().cleanupOrphanedSources(store);
  }, []);

  useEffect(() => {
    return () => {
      panelOpenRef.current = false;
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

  const addImages = useCallback(async (photos: LibraryImage[]) => {
    const picked = photos.slice(0, MAX_IMAGE_ATTACHMENTS);
    if (!picked.length) return;

    currentDocumentAttachmentIdRef.current = null;
    documentAbortRef.current?.abort();
    const requestId = attachmentRequestRef.current + 1;
    attachmentRequestRef.current = requestId;

    setAttachments(
      picked.map((photo) => ({
        id: photo.id,
        type: 'image' as const,
        uri: photo.uri,
        status: 'loading' as const,
      }))
    );

    const resolved = await Promise.all(
      picked.map(async (photo) => ({
        id: photo.id,
        ...(await resolveLibraryUri(photo)),
      }))
    );
    if (attachmentRequestRef.current !== requestId) return;

    const failed = resolved.filter((photo) => !photo.uri);
    if (failed.length) {
      console.warn('Could not resolve picked photos to local files', {
        ids: failed.map((photo) => photo.id),
      });
      Toast.show({
        type: 'defaultToast',
        text1: failed.some((photo) => 'inCloud' in photo && photo.inCloud)
          ? 'That photo is only in iCloud. Open it in Photos first.'
          : 'Could not open that photo.',
      });
    }

    setAttachments((prev) =>
      prev.flatMap((attachment) => {
        const match = resolved.find((photo) => photo.id === attachment.id);
        if (!match) return attachment;
        if (!match.uri) return [];
        return { ...attachment, uri: match.uri, status: 'ready' as const };
      })
    );
  }, []);

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

    const canceled = pickedFileResult.canceled || !pickedFileResult.assets[0];
    pickerClosedRef.current?.(canceled ? 'canceled' : 'picked');
    pickerClosedRef.current = null;

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

        const addArticleSource = () =>
          addSource(
            buildUrlSource(url, article),
            url,
            vectorStore!,
            embeddings,
            handleProgress,
            abortController.signal,
            article.text
          );
        const indexArticleSource = () =>
          embeddings
            ? useLLMStore
                .getState()
                .runWithModelOffloaded(
                  () => embeddings.runWithLoadedModel(addArticleSource),
                  { restore: false }
                )
            : addArticleSource();
        const result = await indexArticleSource();

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
        console.error('URL source processing threw', error, {
          attachmentId,
          url,
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

  const presentDownloadSheet = useCallback(
    (resume: DownloadResume = 'attachment') => {
      downloadResumeRef.current = resume;
      embeddingDownloadSheetOpenRef.current = true;
      embeddingDownloadSheetRef.current?.present();
    },
    []
  );

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

  const markPanelClosed = useCallback(() => {
    panelOpenRef.current = false;
    if (!pendingDownloadSheetRef.current) return;
    pendingDownloadSheetRef.current = false;
    presentDownloadSheet();
  }, [presentDownloadSheet]);

  const pickDocument = useCallback(async () => {
    if (useEmbeddingModelStore.getState().status === 'unknown') {
      await awaitVectorStore(STORE_SETTLE_TIMEOUT_MS);
    }
    if (useEmbeddingModelStore.getState().status === 'ready') {
      const closed = new Promise<DocumentPickOutcome>((resolve) => {
        pickerClosedRef.current = resolve;
      });
      runDocumentPicker().catch((error) => {
        pickerClosedRef.current?.('canceled');
        pickerClosedRef.current = null;
        console.error('Document attachment failed', error);
      });
      return closed;
    }
    if (panelOpenRef.current) {
      pendingDownloadSheetRef.current = true;
      return;
    }
    presentDownloadSheet();
  }, [awaitVectorStore, runDocumentPicker, presentDownloadSheet]);

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
    const store = await awaitVectorStore(STORE_READY_TIMEOUT_MS);
    if (!store) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Document storage is still starting up. Try again in a moment.',
      });
      return;
    }
    const ready = await useLLMStore.getState().runWithModelOffloaded(
      async () => {
        const loaded = await useEmbeddingModelStore
          .getState()
          .ensureReady(store);
        await embeddingsRef.current?.unload();
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
    pendingDocumentPickRef.current = downloadResumeRef.current === 'attachment';
    embeddingDownloadSheetRef.current?.dismiss();
  }, [awaitVectorStore]);

  const restoreAttachments = useCallback((previous: Attachment[]) => {
    setAttachments(previous);
  }, []);

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

  const markPanelOpen = useCallback(() => {
    panelOpenRef.current = true;
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
    embeddingDownloadSheetRef,
    addImages,
    presentDownloadSheet,
    pickDocument,
    addUrlSource,
    downloadModelAndContinue,
    markDownloadSheetClosed,
    markPanelOpen,
    markPanelClosed,
    removeAttachment,
    restoreAttachments,
    clearAll,
    addPastedAttachment,
  };
};
