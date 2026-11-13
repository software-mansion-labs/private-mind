import AsyncStorage from '@react-native-async-storage/async-storage';

const MODEL_UPDATE_CONSENT_KEY = 'model_update_consent';

export interface ModelUpdateConsent {
  modelNames: string[];
  overMobileData: boolean;
}

const NO_CONSENT: ModelUpdateConsent = {
  modelNames: [],
  overMobileData: false,
};

const isConsent = (value: unknown): value is ModelUpdateConsent =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as ModelUpdateConsent).modelNames) &&
  typeof (value as ModelUpdateConsent).overMobileData === 'boolean';

export const getModelUpdateConsent = async (): Promise<ModelUpdateConsent> => {
  const value = await AsyncStorage.getItem(MODEL_UPDATE_CONSENT_KEY);
  if (!value) return NO_CONSENT;
  try {
    const parsed: unknown = JSON.parse(value);
    return isConsent(parsed) ? parsed : NO_CONSENT;
  } catch {
    return NO_CONSENT;
  }
};

export const setModelUpdateConsent = (consent: ModelUpdateConsent) =>
  consent.modelNames.length === 0
    ? AsyncStorage.removeItem(MODEL_UPDATE_CONSENT_KEY)
    : AsyncStorage.setItem(MODEL_UPDATE_CONSENT_KEY, JSON.stringify(consent));
