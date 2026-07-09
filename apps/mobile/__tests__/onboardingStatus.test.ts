import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isOnboardingComplete,
  markOnboardingComplete,
} from '../utils/onboardingStatus';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('isOnboardingComplete', () => {
  it('returns false when key is not set (null)', async () => {
    mockGetItem.mockResolvedValue(null);
    expect(await isOnboardingComplete()).toBe(false);
  });

  it('returns false when stored value is "false"', async () => {
    mockGetItem.mockResolvedValue('false');
    expect(await isOnboardingComplete()).toBe(false);
  });

  it('returns true when stored value is "true"', async () => {
    mockGetItem.mockResolvedValue('true');
    expect(await isOnboardingComplete()).toBe(true);
  });

  it('returns false for unexpected stored value', async () => {
    mockGetItem.mockResolvedValue('yes');
    expect(await isOnboardingComplete()).toBe(false);
  });

  it('reads from the correct AsyncStorage key', async () => {
    mockGetItem.mockResolvedValue(null);
    await isOnboardingComplete();
    expect(mockGetItem).toHaveBeenCalledWith('onboarding_complete');
  });
});

describe('markOnboardingComplete', () => {
  it('stores "true" under the correct key', async () => {
    mockSetItem.mockResolvedValue(undefined);
    await markOnboardingComplete();
    expect(mockSetItem).toHaveBeenCalledWith('onboarding_complete', 'true');
  });

  it('after marking complete, isOnboardingComplete returns true', async () => {
    mockSetItem.mockResolvedValue(undefined);
    mockGetItem.mockResolvedValue('true');

    await markOnboardingComplete();
    expect(await isOnboardingComplete()).toBe(true);
  });
});
