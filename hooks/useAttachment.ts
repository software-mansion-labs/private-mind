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

/** A photo as the in-app grid and the camera hand it over. */
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

/**
 * The send path carries one image: ExecuTorch takes a single `mediaPath` per
 * message and `messages.imagePath` is a single column. The grid is built for a
 * set, so the cap lives here rather than in the picker.
 */
export const MAX_IMAGE_ATTACHMENTS = 1;

/**
 * A library asset id is not a file. `expo-image` draws `ph://` directly, but
 * `persistImage` copies with the file system and ExecuTorch reads a path, so
 * the asset has to be resolved before either sees it. Android hands back a
 * `file://` uri already.
 */
const RESOLVE_TIMEOUT_MS = 8000;

const resolveLibraryUri = async (
  photo: LibraryImage
): Promise<string | null> => {
  if (!photo.uri.startsWith('ph://')) return photo.uri;
  try {
    const info = await Promise.race([
      // `shouldDownloadFromNetwork` defaults to true, which blocks on an iCloud
      // asset for as long as the fetch takes. The picker is not the place to
      // wait on the network.
      MediaLibrary.getAssetInfoAsync(photo.id, {
        shouldDownloadFromNetwork: false,
      }),
      // And a bound on it regardless: a resolve that never settles would leave
      // the attachment `loading` forever, with send disabled and no way back.
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), RESOLVE_TIMEOUT_MS)
      ),
    ]);
    return info?.localUri ?? null;
  } catch (error) {
    console.error('Failed to resolve a library asset to a local file', error);
    return null;
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
      panelOpenRef.current = false;
      embeddingDownloadSheetOpenRef.current = false;
      pendingDownloadSheetRef.current = false;
      pendingDocumentPickRef.current = false;
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

  /**
   * Takes the photos the grid or the camera just handed over. They land as
   * `loading` wearing the uri the flight was drawing, so the thumbnail the copy
   * lands on shows the photo at once; resolving the asset to a real file only
   * decides when the message can be sent.
   */
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
        uri: await resolveLibraryUri(photo),
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
        text1: 'Could not open that photo.',
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

  const presentDownloadSheet = useCallback(() => {
    embeddingDownloadSheetOpenRef.current = true;
    embeddingDownloadSheetRef.current?.present();
  }, []);

  const markDownloadSheetClosed = useCallback(() => {
    embeddingDownloadSheetOpenRef.current = false;
    if (!pendingDocumentPickRef.current) return;
    pendingDocumentPickRef.current = false;
    runDocumentPicker().catch((error) => {
      console.error('Failed to open the document picker after download', error);
    });
  }, [runDocumentPicker]);

  const markPanelClosed = useCallback(() => {
    panelOpenRef.current = false;
    if (!pendingDownloadSheetRef.current) return;
    pendingDownloadSheetRef.current = false;
    presentDownloadSheet();
  }, [presentDownloadSheet]);

  const pickDocument = useCallback(async () => {
    if (useEmbeddingModelStore.getState().status === 'ready') {
      return runDocumentPicker();
    }
    if (panelOpenRef.current) {
      // The panel is already collapsing — the download sheet waits for it, so
      // the two never overlap.
      pendingDownloadSheetRef.current = true;
      return;
    }
    presentDownloadSheet();
  }, [runDocumentPicker, presentDownloadSheet]);

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
    pickDocument,
    downloadModelAndContinue,
    markDownloadSheetClosed,
    markPanelOpen,
    markPanelClosed,
    removeAttachment,
    clearAll,
    addPastedAttachment,
  };
};
