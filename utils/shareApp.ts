import { Share } from 'react-native';

export const APP_SITE_URL = 'https://privatemind.swmansion.com';

export const SHARE_APP_MESSAGE = `Private Mind runs AI chat on your phone: documents, images, voice and web search, with nothing sent to a server of ours. Free and open source. ${APP_SITE_URL}`;

export const shareApp = async (): Promise<boolean> => {
  try {
    const result = await Share.share({ message: SHARE_APP_MESSAGE });
    return result.action === Share.sharedAction;
  } catch (error) {
    console.warn('Sharing the app failed', error);
    return false;
  }
};
