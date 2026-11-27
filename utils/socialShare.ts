import { Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { nativeShareImage } from '../modules/share-image';
import { APP_SITE_URL } from './shareApp';
import { writeShareCardImage } from './shareUsageCard';
import {
  type UsageSummary,
  approximately,
  formatCount,
  pagesLabel,
} from './usageStats';

export type SocialNetwork = 'x' | 'linkedin' | 'reddit';

export const SOCIAL_APP_PACKAGES: Record<SocialNetwork, string> = {
  x: 'com.twitter.android',
  linkedin: 'com.linkedin.android',
  reddit: 'com.reddit.frontpage',
};

export const X_POST_LIMIT = 280;
export const X_LINK_LENGTH = 23;
export const X_HASHTAGS = '#OnDeviceAI #PrivateMind';
export const LINKEDIN_HASHTAGS = '#OnDeviceAI #Privacy #PrivateMind';
export const LINKEDIN_TEXT_COPIED = 'Text copied — paste it into your post';

const phonePhrase = (deviceName: string | null): string =>
  deviceName ? `My ${deviceName}` : 'My phone';

const pagesPhrase = (summary: UsageSummary): string =>
  approximately(pagesLabel(summary.pages), summary.approximate);

export const xPostLength = (text: string): number =>
  [...text].length + 1 + X_LINK_LENGTH;

export const xPostText = (
  summary: UsageSummary,
  deviceName: string | null
): string => {
  const headline = `${phonePhrase(deviceName)} has written ${pagesPhrase(summary)} with Private Mind.`;
  const full = `${headline} The AI runs entirely on the phone: 0 bytes sent to the cloud. ${X_HASHTAGS}`;
  if (xPostLength(full) <= X_POST_LIMIT) return full;
  return `${headline} ${X_HASHTAGS}`;
};

export const linkedInPostText = (
  summary: UsageSummary,
  deviceName: string | null
): string =>
  [
    `${phonePhrase(deviceName)} has written ${pagesPhrase(summary)} of AI answers with Private Mind: ${approximately(formatCount(summary.words), summary.approximate)} words across ${formatCount(summary.chats)} chats, and not a single byte of it went to the cloud.`,
    '',
    'Private Mind runs language models entirely on the phone. No account, no server, and it keeps working offline, so what you ask stays with you. It is free and open source, built by Software Mansion.',
    '',
    LINKEDIN_HASHTAGS,
    APP_SITE_URL,
  ].join('\n');

export const redditPostTitle = (
  summary: UsageSummary,
  deviceName: string | null
): string =>
  `${phonePhrase(deviceName)} has written ${pagesPhrase(summary)} with an AI that runs entirely on the phone`;

export const redditSubmitUrl = (
  title: string,
  url: string = APP_SITE_URL
): string =>
  `https://www.reddit.com/submit?title=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;

export const xIntentUrl = (text: string, url: string = APP_SITE_URL): string =>
  `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

export const linkedInShareUrl = (url: string = APP_SITE_URL): string =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

const installedAppFor = (network: SocialNetwork): string | null => {
  if (Platform.OS !== 'android' || !nativeShareImage) return null;
  const packageName = SOCIAL_APP_PACKAGES[network];
  return nativeShareImage.isInstalled(packageName) ? packageName : null;
};

const postToApp = async (
  packageName: string,
  text: string,
  renderCard: () => Promise<string>
) => {
  const imageUri = writeShareCardImage(await renderCard());
  await nativeShareImage?.shareToPackage(imageUri, text, packageName);
};

const postOnX = async (
  summary: UsageSummary,
  deviceName: string | null,
  renderCard: () => Promise<string>
) => {
  const text = xPostText(summary, deviceName);
  const app = installedAppFor('x');
  if (app) {
    await postToApp(app, `${text} ${APP_SITE_URL}`, renderCard);
    return;
  }
  await Linking.openURL(xIntentUrl(text));
};

const shareOnLinkedIn = async (
  summary: UsageSummary,
  deviceName: string | null,
  renderCard: () => Promise<string>
) => {
  const text = linkedInPostText(summary, deviceName);
  await Clipboard.setStringAsync(text);
  Toast.show({ type: 'defaultToast', text1: LINKEDIN_TEXT_COPIED });
  const app = installedAppFor('linkedin');
  if (app) {
    await postToApp(app, text, renderCard);
    return;
  }
  await Linking.openURL(linkedInShareUrl());
};

const postOnReddit = async (
  summary: UsageSummary,
  deviceName: string | null,
  renderCard: () => Promise<string>
) => {
  const title = redditPostTitle(summary, deviceName);
  const app = installedAppFor('reddit');
  if (app) {
    await postToApp(app, `${title} ${APP_SITE_URL}`, renderCard);
    return;
  }
  await Linking.openURL(redditSubmitUrl(title));
};

const POSTERS: Record<
  SocialNetwork,
  (
    summary: UsageSummary,
    deviceName: string | null,
    renderCard: () => Promise<string>
  ) => Promise<void>
> = {
  x: postOnX,
  linkedin: shareOnLinkedIn,
  reddit: postOnReddit,
};

export const postToNetwork = (
  network: SocialNetwork,
  summary: UsageSummary,
  deviceName: string | null,
  renderCard: () => Promise<string>
): Promise<void> => POSTERS[network](summary, deviceName, renderCard);
