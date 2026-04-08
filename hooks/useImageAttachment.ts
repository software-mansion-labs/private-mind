import { useState, useRef, useCallback } from 'react';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Platform, PermissionsAndroid } from 'react-native';
import Toast from 'react-native-toast-message';

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

export const useImageAttachment = () => {
  const [imagePath, setImagePath] = useState<string | undefined>(undefined);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const imageSourceSheetRef = useRef<BottomSheetModal>(null);

  const pickFromLibrary = useCallback(async () => {
    const granted = await requestAndroidGalleryPermission();
    if (!granted) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Photo library permission is required to attach images.',
      });
      return;
    }
    setIsLoadingImage(true);
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
      });
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
