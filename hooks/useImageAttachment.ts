import { useState, useRef, useCallback } from 'react';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { BottomSheetModal } from '@gorhom/bottom-sheet';

export const useImageAttachment = () => {
  const [imagePath, setImagePath] = useState<string | undefined>(undefined);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const imageSourceSheetRef = useRef<BottomSheetModal>(null);

  const pickFromLibrary = useCallback(async () => {
    setIsLoadingImage(true);
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 1 });
      if (!result.didCancel && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (uri) setImagePath(uri);
      }
    } finally {
      setIsLoadingImage(false);
    }
  }, []);

  const pickFromCamera = useCallback(async () => {
    setIsLoadingImage(true);
    try {
      const result = await launchCamera({ mediaType: 'photo', quality: 1 });
      if (!result.didCancel && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        if (uri) setImagePath(uri);
      }
    } finally {
      setIsLoadingImage(false);
    }
  }, []);

  const openSourceSheet = useCallback(() => {
    imageSourceSheetRef.current?.present();
  }, []);

  const clearImage = useCallback(() => {
    setImagePath(undefined);
  }, []);

  return {
    imagePath,
    setImagePath,
    isLoadingImage,
    imageSourceSheetRef,
    pickFromLibrary,
    pickFromCamera,
    openSourceSheet,
    clearImage,
  };
};
