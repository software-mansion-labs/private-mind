import { useCallback } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useSourceStore } from '../store/sourceStore';
import { useVectorStore } from '../context/VectorStoreContext';
import { Source } from '../database/sourcesRepository';

export const useSourceUpload = () => {
  const { addSource } = useSourceStore();
  const { vectorStore } = useVectorStore();

  const uploadSource = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.uri || '';
      const newSource: Omit<Source, 'id'> = {
        name:
          asset.name.split('.')[0] ||
          asset.uri.split('/').pop()?.split('.')[0] ||
          'Unnamed',
        type: asset.uri.split('.').pop() || '',
        size: asset.size || null,
      };

      await addSource(newSource, uri, vectorStore!);
    }
  }, [addSource, vectorStore]);

  return { uploadSource };
};