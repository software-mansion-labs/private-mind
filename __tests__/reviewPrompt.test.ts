import { incrementChatCount, shouldPromptReview } from '../utils/reviewPrompt';
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
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('total_chats_created', '1');
  });

  it('increments existing count', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('4');
    const count = await incrementChatCount();
    expect(count).toBe(5);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('total_chats_created', '5');
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
