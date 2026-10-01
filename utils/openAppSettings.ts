import { Linking } from 'react-native';

export const openAppSettings = () => {
  Linking.openSettings().catch(() => {});
};
