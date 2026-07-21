import { useState, useRef, useCallback, useEffect } from 'react';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Platform, PermissionsAndroid } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSourceStore } from '../store/sourceStore';
import { useVectorStore } from '../context/VectorStoreContext';
import { useEmbeddingModelStore } from '../store/embeddingModelStore';
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

interface ClearAllOptions {
  cleanupSources?: boolean;
}

const requestAndroidGalleryPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  const permission =
    Number(Platform.Version) >= 33
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

  const status = await PermissionsAndroid.check(permission);
  if (status) return true;

  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

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
  const sheetRef = useRef<BottomSheetModal>(null);
  const embeddingDownloadSheetRef = useRef<BottomSheetModal>(null);
  const embeddingDownloadSheetOpenRef = useRef(false);
  const { vectorStore, embeddings } = useVectorStore();

  useEffect(() => {
    return () => {
      embeddingDownloadSheetOpenRef.current = false;
    };
  }, []);

  const replaceWithImage = useCallback((uri: string) => {
    currentDocumentAttachmentIdRef.current = null;
    setAttachments([
      { id: `img-${Date.now()}`, type: 'image', uri, status: 'ready' },
    ]);
  }, []);

  const pickFromLibrary = useCallback(async () => {
    const granted = await requestAndroidGalleryPermission();
    if (!granted) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Photo library permission is required to attach images.',
      });
      return;
    }
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
      const result = await addSource(
        newSource,
        asset.uri,
        vectorStore!,
        embeddings,
        handleProgress,
        abortController.signal
      );
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

  const markDownloadSheetClosed = useCallback(() => {
    embeddingDownloadSheetOpenRef.current = false;
  }, []);

  const pickDocument = useCallback(async () => {
    if (useEmbeddingModelStore.getState().status === 'ready') {
      return runDocumentPicker();
    }
    embeddingDownloadSheetOpenRef.current = true;
    embeddingDownloadSheetRef.current?.present();
  }, [runDocumentPicker]);

  const downloadModelAndContinue = useCallback(async () => {
    if (!vectorStore) return;
    const ready = await useEmbeddingModelStore
      .getState()
      .ensureReady(vectorStore);
    if (!ready) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Failed to download the document model.',
      });
      return;
    }
    if (embeddingDownloadSheetOpenRef.current) {
      embeddingDownloadSheetRef.current?.dismiss();
      await runDocumentPicker();
    }
  }, [vectorStore, runDocumentPicker]);

  const removeAttachment = useCallback((id: string) => {
    if (currentDocumentAttachmentIdRef.current === id) {
      currentDocumentAttachmentIdRef.current = null;
      documentAbortRef.current?.abort();
    }
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAll = useCallback(
    (options: ClearAllOptions = {}) => {
      const cleanupSources = options.cleanupSources ?? false;
      const hadDocuments = attachmentsRef.current.some((a) => a.sourceId);
      currentDocumentAttachmentIdRef.current = null;
      documentAbortRef.current?.abort();
      setAttachments([]);
      if (cleanupSources && hadDocuments && vectorStore) {
        useSourceStore.getState().cleanupOrphanedSources(vectorStore);
      }
    },
    [vectorStore]
  );

  const openSheet = useCallback(() => {
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
    pickFromLibrary,
    pickFromCamera,
    pickDocument,
    downloadModelAndContinue,
    markDownloadSheetClosed,
    removeAttachment,
    clearAll,
    openSheet,
    addPastedAttachment,
  };
};
