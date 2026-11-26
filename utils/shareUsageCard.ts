import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { File, Paths } from 'expo-file-system';
import DeviceInfo from 'react-native-device-info';
import { nativeShareImage } from '../modules/share-image';
import { APP_STORE_URL, GOOGLE_PLAY_URL } from '../constants/store-links';
import {
  type UsageSummary,
  approximately,
  formatCount,
  formatPages,
  pagesLabel,
  pagesUnit,
} from './usageStats';

export const SHARE_CARD_FILE_NAME = 'my-private-mind.png';
export const SHARE_CARD_DIALOG_TITLE = 'Share my Private Mind';
export const SHARE_TEXT_COPIED = 'Text copied — paste it into your message';
const MAX_DEVICE_NAME_LENGTH = 24;
const MODEL_CODE = /^(SM-|[A-Z]{2,}-?\d)/;

export const shareableDeviceName = (model: string | null): string | null => {
  const name = model?.trim();
  if (!name || name === 'unknown' || MODEL_CODE.test(name)) return null;
  if (name.length > MAX_DEVICE_NAME_LENGTH) return null;
  return name;
};

export const thisPhoneName = (): string | null =>
  shareableDeviceName(DeviceInfo.getModel());

export const ownerPhrase = (deviceName: string | null): string =>
  deviceName ? `My ${deviceName}` : 'My phone';

export const buildUsageShareMessage = (
  summary: UsageSummary,
  deviceName: string | null
): string =>
  [
    `${ownerPhrase(deviceName)} has written ${approximately(pagesLabel(summary.pages), summary.approximate)} with Private Mind, and 0 bytes went to the cloud. The AI runs entirely on the phone.`,
    '',
    `App Store: ${APP_STORE_URL}`,
    `Google Play: ${GOOGLE_PLAY_URL}`,
  ].join('\n');

export const writeShareCardImage = (pngBase64: string): string => {
  const file = new File(Paths.cache, SHARE_CARD_FILE_NAME);
  file.write(pngBase64, { encoding: 'base64' });
  return file.uri;
};

export const shareUsageCard = async (
  pngBase64: string,
  message: string
): Promise<void> => {
  const imageUri = writeShareCardImage(pngBase64);
  await Clipboard.setStringAsync(message);
  Toast.show({ type: 'defaultToast', text1: SHARE_TEXT_COPIED });
  if (Platform.OS === 'android' && nativeShareImage) {
    await nativeShareImage.share(imageUri, message, SHARE_CARD_DIALOG_TITLE);
    return;
  }
  await Share.share({ url: imageUri, message });
};

const MAX_MODEL_NAME_LENGTH = 20;
const ELLIPSIS = '…';
export const NO_VALUE = '–';

const truncate = (text: string, limit: number): string =>
  text.length > limit
    ? `${text.slice(0, limit - 1).trimEnd()}${ELLIPSIS}`
    : text;

export interface ShareCardContent {
  owner: string;
  pages: string;
  pagesUnit: string;
  tokens: string;
  words: string;
  chats: string;
  mostUsedModel: string;
  bestSpeed: string;
}

export const shareCardContent = (
  summary: UsageSummary,
  deviceName: string | null
): ShareCardContent => ({
  owner: `${ownerPhrase(deviceName)} has written${summary.approximate ? ' about' : ''}`,
  pages: formatPages(summary.pages),
  pagesUnit: pagesUnit(summary.pages),
  tokens: formatCount(summary.tokens),
  words: formatCount(summary.words),
  chats: formatCount(summary.chats),
  mostUsedModel: summary.mostUsedModel
    ? truncate(summary.mostUsedModel, MAX_MODEL_NAME_LENGTH)
    : NO_VALUE,
  bestSpeed:
    summary.bestTokensPerSecond > 0
      ? `${Math.round(summary.bestTokensPerSecond)} tok/s`
      : NO_VALUE,
});

export const milestoneHeadline = (
  pages: number,
  deviceName: string | null = thisPhoneName()
): string =>
  `${deviceName ? `Your ${deviceName}` : 'Your phone'} has written ${formatCount(pages)} A4 pages`;
