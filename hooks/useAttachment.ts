import { useState, useRef, useCallback } from 'react';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Platform, PermissionsAndroid } from 'react-native';
import Toast from 'react-native-toast-message';
import { readDocumentText } from '../utils/fileReaders';
import { useSourceStore } from '../store/sourceStore';
import { useVectorStore } from '../context/VectorStoreContext';

const INLINE_THRESHOLD = 4096;

export interface Attachment {
  id: string;
  type: 'image' | 'document';
  uri: string;
  name?: string;
  status: 'loading' | 'ready';
  strategy?: 'inline' | 'rag';
  inlineText?: string;
  sourceId?: number;
  firstChunk?: string;
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

export const useAttachment = () => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const sheetRef = useRef<BottomSheetModal>(null);
  const { vectorStore } = useVectorStore();

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
        setAttachments((prev) => [
          ...prev,
          { id: `img-${Date.now()}`, type: 'image', uri, status: 'ready' },
        ]);
      }
    }
  }, []);

  const pickFromCamera = useCallback(async () => {
    const result = await launchCamera({ mediaType: 'photo', quality: 1 });
    if (!result.didCancel && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      if (uri) {
        setAttachments((prev) => [
          ...prev,
          { id: `img-${Date.now()}`, type: 'image', uri, status: 'ready' },
        ]);
      }
    }
  }, []);

  const pickDocument = useCallback(async () => {
    const pickedFileResult = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain', 'text/markdown', 'text/html'],
      copyToCacheDirectory: true,
    });

    if (pickedFileResult.canceled || !pickedFileResult.assets[0]) return;

    const asset = pickedFileResult.assets[0];
    const fileType = asset.uri.split('.').pop() || '';
    const fileName =
      asset.name?.split('.')[0] ||
      asset.uri.split('/').pop()?.split('.')[0] ||
      'Unnamed';
    const attachmentId = `doc-${Date.now()}`;

    setAttachments((prev) => [
      ...prev,
      {
        id: attachmentId,
        type: 'document',
        uri: asset.uri,
        name: asset.name || fileName,
        status: 'loading',
      },
    ]);

    try {
      const text = await readDocumentText(asset.uri, fileType);

      if (!text || text.trim().length === 0) {
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
        Toast.show({
          type: 'defaultToast',
          text1: 'Document appears to be empty.',
        });
        return;
      }

      if (text.length <= INLINE_THRESHOLD) {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachmentId
              ? { ...a, status: 'ready', strategy: 'inline', inlineText: text }
              : a
          )
        );
      } else {
        const firstChunk = text.slice(0, 1000);
        const newSource = {
          name: fileName,
          type: fileType,
          size: asset.size || null,
        };
        const { addSource } = useSourceStore.getState();
        const result = await addSource(newSource, asset.uri, vectorStore!);

        if (result.success) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === attachmentId
                ? {
                    ...a,
                    status: 'ready',
                    strategy: 'rag',
                    firstChunk,
                    sourceId: result.sourceId,
                  }
                : a
            )
          );
        } else {
          setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
          Toast.show({
            type: 'defaultToast',
            text1: 'Failed to process document.',
          });
        }
      }
    } catch {
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      Toast.show({
        type: 'defaultToast',
        text1: 'Error reading document.',
      });
    }
  }, [vectorStore]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearImages = useCallback(() => {
    setAttachments((prev) => prev.filter((a) => a.type !== 'image'));
  }, []);

  const clearAll = useCallback(() => {
    setAttachments([]);
  }, []);

  const openSheet = useCallback(() => {
    sheetRef.current?.present();
  }, []);

  return {
    attachments,
    sheetRef,
    pickFromLibrary,
    pickFromCamera,
    pickDocument,
    removeAttachment,
    clearAll,
    openSheet,
  };
};
