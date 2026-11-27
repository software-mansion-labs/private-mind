import { Linking, Platform } from 'react-native';
import {
  APP_STORE_REVIEW_URL,
  GOOGLE_PLAY_URL,
} from '../constants/store-links';
import { noteAskedNow } from './askAfterAnswer';
import { noteReviewAskedByUser } from './reviewPrompt';

export const storeReviewUrl = (os: string): string =>
  os === 'ios' ? APP_STORE_REVIEW_URL : GOOGLE_PLAY_URL;

export const rateApp = async (): Promise<void> => {
  noteAskedNow();
  await noteReviewAskedByUser();
  try {
    await Linking.openURL(storeReviewUrl(Platform.OS));
  } catch (error) {
    console.warn('Opening the store listing failed', error);
  }
};
