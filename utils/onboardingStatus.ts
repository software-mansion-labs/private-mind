import AsyncStorage from '@react-native-async-storage/async-storage';

enum OnboardingCompleteValue {
  TRUE = 'true',
  FALSE = 'false',
}
const ONBOARDING_COMPLETE_STORE_KEY = 'onboarding_complete';

export const isOnboardingComplete = async (): Promise<boolean> => {
  const value =
    (await AsyncStorage.getItem(ONBOARDING_COMPLETE_STORE_KEY)) ??
    OnboardingCompleteValue.FALSE;

  return value === OnboardingCompleteValue.TRUE;
};

export const markOnboardingComplete = () =>
  AsyncStorage.setItem(
    ONBOARDING_COMPLETE_STORE_KEY,
    OnboardingCompleteValue.TRUE
  );
