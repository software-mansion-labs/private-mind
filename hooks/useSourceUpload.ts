import { useCallback, useRef } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useSourceStore } from '../store/sourceStore';
import { useVectorStore } from '../context/VectorStoreContext';
import { Source } from '../database/sourcesRepository';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { WarningSheetData } from '../components/bottomSheets/WarningSheet';
import Toast from 'react-native-toast-message';

export const useSourceUpload = () => {
  const { addSource } = useSourceStore();
  const { vectorStore } = useVectorStore();
  const warningSheetRef = useRef<BottomSheetModal<WarningSheetData> | null>(
    null
  );

  const uploadSource = useCallback(async () => {
    const pickedFileResult = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain', 'text/markdown', 'text/html'],
      copyToCacheDirectory: true,
    });

    if (!pickedFileResult.canceled && pickedFileResult.assets[0]) {
      const asset = pickedFileResult.assets[0];
      const uri = asset.uri || '';
      const newSource: Omit<Source, 'id'> = {
        name:
          asset.name.split('.')[0] ||
          asset.uri.split('/').pop()?.split('.')[0] ||
          'Unnamed',
        type: asset.uri.split('.').pop() || '',
        size: asset.size || null,
      };

      const result = await addSource(newSource, uri, vectorStore!);

      if (result.success) {
        Toast.show({
          type: 'defaultToast',
          text1: `${newSource.name} has been successfully added`,
        });
      } else if (result.isEmpty) {
        warningSheetRef.current?.present({
          title: "Can't read document",
          subtitle: `The document "${newSource.name}" appears to be empty or unreadable. It won't be added to your sources.`,
          buttonTitle: 'OK',
          onConfirm: () => {},
        });
      } else {
        warningSheetRef.current?.present({
          title: "Can't read document",
          subtitle: `There was an error processing the document "${newSource.name}". Please try again.`,
          buttonTitle: 'OK',
          onConfirm: () => {},
        });
      }
    }
  }, [addSource, vectorStore]);

  return { uploadSource, warningSheetRef };
};
