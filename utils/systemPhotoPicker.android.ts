import * as ImagePicker from 'expo-image-picker';

export interface PickedPhoto {
  id: string;
  uri: string;
}

export const launchSystemPhotoPicker =
  async (): Promise<PickedPhoto | null> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    return asset ? { id: asset.assetId ?? asset.uri, uri: asset.uri } : null;
  };
