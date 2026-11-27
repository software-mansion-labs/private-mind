import { Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { writtenFiles } from '../__mocks__/expo-file-system';
import {
  EMPTY_USAGE_TOTALS,
  TOKENS_PER_A4_PAGE,
  summarizeUsage,
} from '../utils/usageStats';

const mockIsInstalled = jest.fn<boolean, [string]>(() => false);
const mockShareToPackage = jest.fn<Promise<void>, unknown[]>(async () => {});

jest.mock('../modules/share-image', () => ({
  nativeShareImage: {
    isInstalled: (packageName: string) => mockIsInstalled(packageName),
    share: jest.fn(),
    shareToPackage: (...args: unknown[]) => mockShareToPackage(...args),
  },
}));

import { APP_SITE_URL } from '../utils/shareApp';
import {
  LINKEDIN_TEXT_COPIED,
  SOCIAL_APP_PACKAGES,
  redditPostTitle,
  redditSubmitUrl,
  X_HASHTAGS,
  X_POST_LIMIT,
  linkedInPostText,
  linkedInShareUrl,
  postToNetwork,
  xIntentUrl,
  xPostLength,
  xPostText,
} from '../utils/socialShare';

const summary = summarizeUsage({
  ...EMPTY_USAGE_TOTALS,
  countedTokens: TOKENS_PER_A4_PAGE * 412,
  countedWords: 206000,
  chats: 38,
});

const hugeEstimate = summarizeUsage({
  ...EMPTY_USAGE_TOTALS,
  estimatedTokens: TOKENS_PER_A4_PAGE * 9876543,
  estimatedWords: 987654321,
  chats: 123456,
});

const LONGEST_DEVICE_NAME = 'Galaxy Z Fold7 Ultra Max';
const renderCard = jest.fn(async () => 'iVBORw0KGgo=');

const setPlatform = (os: 'ios' | 'android') =>
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });

let openURL: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsInstalled.mockReturnValue(false);
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  setPlatform('android');
});

afterEach(() => {
  openURL.mockRestore();
});

describe('the post for X', () => {
  it('names the phone, the pages and the privacy claim with two hashtags', () => {
    const text = xPostText(summary, 'Pixel 10');
    expect(text).toContain('My Pixel 10 has written 412 A4 pages');
    expect(text).toContain('0 bytes sent to the cloud');
    expect(text.endsWith(X_HASHTAGS)).toBe(true);
  });

  it('stays within 280 characters with the link X adds', () => {
    expect(xPostLength(xPostText(summary, 'Pixel 10'))).toBeLessThanOrEqual(
      X_POST_LIMIT
    );
    expect(
      xPostLength(xPostText(hugeEstimate, LONGEST_DEVICE_NAME))
    ).toBeLessThanOrEqual(X_POST_LIMIT);
  });

  it('counts the link the way X does, as 23 characters', () => {
    expect(xPostLength('a'.repeat(256))).toBe(X_POST_LIMIT);
  });

  it('says "about" when the figure rests on the estimate', () => {
    expect(xPostText(hugeEstimate, null)).toContain(
      'My phone has written about 9,876,543 A4 pages'
    );
  });

  it('encodes the text and the link into the web intent', () => {
    const url = new URL(xIntentUrl('Pages & tokens #OnDeviceAI'));
    expect(url.origin + url.pathname).toBe('https://x.com/intent/post');
    expect(url.searchParams.get('text')).toBe('Pages & tokens #OnDeviceAI');
    expect(url.searchParams.get('url')).toBe(APP_SITE_URL);
    expect(xIntentUrl('a b#c')).toContain('text=a%20b%23c');
  });
});

describe('the post for LinkedIn', () => {
  it('tells the longer story with the phone, the totals and the link', () => {
    const text = linkedInPostText(summary, 'Pixel 10');
    expect(text).toContain('My Pixel 10 has written 412 A4 pages');
    expect(text).toContain('206,000 words across 38 chats');
    expect(text).toContain('not a single byte of it went to the cloud');
    expect(text.trimEnd().endsWith(APP_SITE_URL)).toBe(true);
    expect(text.length).toBeGreaterThan(X_POST_LIMIT);
  });

  it('shares only the encoded link through the web page', () => {
    expect(linkedInShareUrl()).toBe(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(APP_SITE_URL)}`
    );
  });
});

describe('posting from the My Private Mind screen', () => {
  it('hands the card and the post with its link to the X app when it is installed', async () => {
    mockIsInstalled.mockReturnValue(true);

    await postToNetwork('x', summary, 'Pixel 10', renderCard);

    expect(mockIsInstalled).toHaveBeenCalledWith(SOCIAL_APP_PACKAGES.x);
    expect(writtenFiles.get('file:///cache/my-private-mind.png')).toBe(
      'iVBORw0KGgo='
    );
    expect(mockShareToPackage).toHaveBeenCalledWith(
      'file:///cache/my-private-mind.png',
      `${xPostText(summary, 'Pixel 10')} ${APP_SITE_URL}`,
      'com.twitter.android'
    );
    expect(openURL).not.toHaveBeenCalled();
  });

  it('opens the X web intent when the app is missing, without drawing the card', async () => {
    await postToNetwork('x', summary, 'Pixel 10', renderCard);

    expect(openURL).toHaveBeenCalledWith(
      xIntentUrl(xPostText(summary, 'Pixel 10'))
    );
    expect(renderCard).not.toHaveBeenCalled();
    expect(mockShareToPackage).not.toHaveBeenCalled();
  });

  it('copies the LinkedIn post and says so before opening the web share page', async () => {
    await postToNetwork('linkedin', summary, 'Pixel 10', renderCard);

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      linkedInPostText(summary, 'Pixel 10')
    );
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: LINKEDIN_TEXT_COPIED })
    );
    expect(openURL).toHaveBeenCalledWith(linkedInShareUrl());
  });

  it('hands the card to the LinkedIn app when it is installed', async () => {
    mockIsInstalled.mockReturnValue(true);

    await postToNetwork('linkedin', summary, 'Pixel 10', renderCard);

    expect(mockShareToPackage).toHaveBeenCalledWith(
      'file:///cache/my-private-mind.png',
      linkedInPostText(summary, 'Pixel 10'),
      'com.linkedin.android'
    );
    expect(openURL).not.toHaveBeenCalled();
  });

  it('hands the card and a title with the link to the Reddit app when it is installed', async () => {
    mockIsInstalled.mockReturnValue(true);

    await postToNetwork('reddit', summary, 'Pixel 10', renderCard);

    expect(mockShareToPackage).toHaveBeenCalledWith(
      'file:///cache/my-private-mind.png',
      `${redditPostTitle(summary, 'Pixel 10')} ${APP_SITE_URL}`,
      'com.reddit.frontpage'
    );
    expect(openURL).not.toHaveBeenCalled();
  });

  it('opens the Reddit submit page with the title and the link when the app is missing', async () => {
    await postToNetwork('reddit', summary, 'Pixel 10', renderCard);

    expect(openURL).toHaveBeenCalledWith(
      redditSubmitUrl(redditPostTitle(summary, 'Pixel 10'))
    );
    expect(renderCard).not.toHaveBeenCalled();
  });

  it('keeps the Reddit title within the 300 characters Reddit allows', () => {
    expect(
      redditPostTitle(summary, 'Samsung Galaxy S25 Ultra').length
    ).toBeLessThanOrEqual(300);
  });

  it('uses the web intents on iOS, where no app can be targeted with an image', async () => {
    setPlatform('ios');
    mockIsInstalled.mockReturnValue(true);

    await postToNetwork('x', summary, 'iPhone 17', renderCard);

    expect(mockIsInstalled).not.toHaveBeenCalled();
    expect(openURL).toHaveBeenCalledWith(
      xIntentUrl(xPostText(summary, 'iPhone 17'))
    );
  });
});
