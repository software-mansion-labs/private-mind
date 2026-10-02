import * as StoreReview from 'expo-store-review';
import {
  incrementChatCount,
  noteChatCreated,
  promptReviewIfDue,
  shouldPromptReview,
} from '../utils/reviewPrompt';

jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(async () => true),
  requestReview: jest.fn(async () => undefined),
}));
import AsyncStorage from '@react-native-async-storage/async-storage';

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
});

describe('incrementChatCount', () => {
  it('initializes count to 1 when no prior value', async () => {
    const count = await incrementChatCount();
    expect(count).toBe(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'total_chats_created',
      '1'
    );
  });

  it('increments existing count', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('4');
    const count = await incrementChatCount();
    expect(count).toBe(5);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'total_chats_created',
      '5'
    );
  });
});

describe('shouldPromptReview', () => {
  it('returns true at count 5 with no prior prompt', () => {
    expect(shouldPromptReview(5, null)).toBe(true);
  });

  it('returns false at count 4', () => {
    expect(shouldPromptReview(4, null)).toBe(false);
  });

  it('returns false at count 6 when last prompted at 5', () => {
    expect(shouldPromptReview(6, 5)).toBe(false);
  });

  it('returns true at count 25 when last prompted at 5', () => {
    expect(shouldPromptReview(25, 5)).toBe(true);
  });

  it('returns true at count 45 when last prompted at 25', () => {
    expect(shouldPromptReview(45, 25)).toBe(true);
  });

  it('returns false at count 24 when last prompted at 5', () => {
    expect(shouldPromptReview(24, 5)).toBe(false);
  });
});

describe('when the review prompt shows', () => {
  it('waits for the answer instead of interrupting the chat that made it due', async () => {
    (AsyncStorage.getItem as jest.Mock)
      .mockResolvedValueOnce('4')
      .mockResolvedValueOnce(null);

    await noteChatCreated();
    expect(StoreReview.requestReview).not.toHaveBeenCalled();

    await promptReviewIfDue();
    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('asks once per time it becomes due', async () => {
    (AsyncStorage.getItem as jest.Mock)
      .mockResolvedValueOnce('4')
      .mockResolvedValueOnce(null);
    await noteChatCreated();

    await promptReviewIfDue();
    await promptReviewIfDue();

    expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
  });

  it('stays quiet after an answer when no review is due', async () => {
    await promptReviewIfDue();

    expect(StoreReview.requestReview).not.toHaveBeenCalled();
  });
});
