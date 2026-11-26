import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { writtenFiles } from '../__mocks__/expo-file-system';
import {
  EMPTY_USAGE_TOTALS,
  TOKENS_PER_A4_PAGE,
  summarizeUsage,
} from '../utils/usageStats';

const mockNativeShare = jest.fn<Promise<void>, unknown[]>(async () => {});

jest.mock('../modules/share-image', () => ({
  nativeShareImage: { share: (...args: unknown[]) => mockNativeShare(...args) },
}));

import {
  SHARE_CARD_DIALOG_TITLE,
  SHARE_TEXT_COPIED,
  buildUsageShareMessage,
  milestoneHeadline,
  shareCardContent,
  shareUsageCard,
  shareableDeviceName,
} from '../utils/shareUsageCard';

const summary = summarizeUsage({
  ...EMPTY_USAGE_TOTALS,
  countedTokens: TOKENS_PER_A4_PAGE * 412,
  countedWords: 206000,
  chats: 38,
  mostUsedModel: 'Qwen 2.5 0.5B',
  bestTokensPerSecond: 41.6,
});

const setPlatform = (os: 'ios' | 'android') =>
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });

afterEach(() => {
  mockNativeShare.mockClear();
  jest.restoreAllMocks();
});

describe('the share message', () => {
  it('states the pages, the privacy claim and both store links', () => {
    const message = buildUsageShareMessage(summary, 'Pixel 10');

    expect(message).toContain('My Pixel 10 has written 412 A4 pages');
    expect(message).toContain('0 bytes went to the cloud');
    expect(message).toContain(
      'https://apps.apple.com/app/private-mind/id6746713439'
    );
    expect(message).toContain(
      'https://play.google.com/store/apps/details?id=com.swmansion.privatemind'
    );
  });

  it('says "about" while the figure rests mostly on the estimate', () => {
    const estimated = summarizeUsage({
      ...EMPTY_USAGE_TOTALS,
      estimatedTokens: TOKENS_PER_A4_PAGE * 20,
    });

    expect(buildUsageShareMessage(estimated, null)).toContain(
      'My phone has written about 20 A4 pages'
    );
  });

  it('carries no chat content, only the totals', () => {
    const message = buildUsageShareMessage(summary, 'Pixel 10');
    expect(message).not.toContain('Qwen');
    expect(message.split('\n')).toHaveLength(4);
  });
});

describe('the card text', () => {
  it('lays out the totals the card shows', () => {
    expect(shareCardContent(summary, 'Pixel 10')).toEqual({
      owner: 'My Pixel 10 has written',
      pages: '412',
      pagesUnit: 'A4 pages',
      tokens: '267,800',
      words: '206,000',
      chats: '38',
      mostUsedModel: 'Qwen 2.5 0.5B',
      bestSpeed: '42 tok/s',
    });
  });

  it('shortens a model name too long for its column', () => {
    const content = shareCardContent(
      { ...summary, mostUsedModel: 'Llama 3.2 3B Instruct SpinQuant' },
      null
    );
    expect(content.mostUsedModel.length).toBeLessThanOrEqual(20);
    expect(content.mostUsedModel.endsWith('…')).toBe(true);
  });

  it('names the phone in the milestone headline', () => {
    expect(milestoneHeadline(100, 'Pixel 10')).toBe(
      'Your Pixel 10 has written 100 A4 pages'
    );
    expect(milestoneHeadline(1000, null)).toBe(
      'Your phone has written 1,000 A4 pages'
    );
  });
});

describe('naming the phone on the card', () => {
  it('keeps a readable model name', () => {
    expect(shareableDeviceName('Pixel 10')).toBe('Pixel 10');
    expect(shareableDeviceName('iPhone 17')).toBe('iPhone 17');
  });

  it('falls back to "phone" for a bare model code', () => {
    expect(shareableDeviceName('SM-G780G')).toBeNull();
    expect(shareableDeviceName('CPH2451')).toBeNull();
    expect(shareableDeviceName('unknown')).toBeNull();
    expect(shareableDeviceName(null)).toBeNull();
  });
});

describe('opening the share sheet', () => {
  it('writes the card as a PNG and hands Android the image with the text', async () => {
    setPlatform('android');

    await shareUsageCard('iVBORw0KGgo=', 'message text');

    expect(writtenFiles.get('file:///cache/my-private-mind.png')).toBe(
      'iVBORw0KGgo='
    );
    expect(mockNativeShare).toHaveBeenCalledWith(
      'file:///cache/my-private-mind.png',
      'message text',
      SHARE_CARD_DIALOG_TITLE
    );
  });

  it('copies the text and says so first, for apps that drop the text beside an image', async () => {
    setPlatform('android');
    const order: string[] = [];
    (Clipboard.setStringAsync as jest.Mock).mockImplementationOnce(async () => {
      order.push('copied');
      return true;
    });
    mockNativeShare.mockImplementationOnce(async () => {
      order.push('shared');
    });

    await shareUsageCard('iVBORw0KGgo=', 'message text');

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('message text');
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: SHARE_TEXT_COPIED })
    );
    expect(order).toEqual(['copied', 'shared']);
  });

  it('hands iOS the image and the text through the system share sheet', async () => {
    setPlatform('ios');
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction });

    await shareUsageCard('iVBORw0KGgo=', 'message text');

    expect(share).toHaveBeenCalledWith({
      url: 'file:///cache/my-private-mind.png',
      message: 'message text',
    });
    expect(mockNativeShare).not.toHaveBeenCalled();
  });
});
