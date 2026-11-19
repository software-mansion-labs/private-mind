import AsyncStorage from '@react-native-async-storage/async-storage';
import { type RetiredModelNotice } from './modelUpdate';

const RETIRED_MODEL_NOTICES_KEY = 'retired_model_notices';

const isNotice = (value: unknown): value is RetiredModelNotice =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as RetiredModelNotice).modelName === 'string' &&
  typeof (value as RetiredModelNotice).replacement === 'string';

export const getRetiredModelNotices = async (): Promise<
  RetiredModelNotice[]
> => {
  const value = await AsyncStorage.getItem(RETIRED_MODEL_NOTICES_KEY);
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isNotice) : [];
  } catch {
    return [];
  }
};

export const setRetiredModelNotices = (notices: RetiredModelNotice[]) =>
  AsyncStorage.setItem(RETIRED_MODEL_NOTICES_KEY, JSON.stringify(notices));
