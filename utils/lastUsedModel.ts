import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_USED_MODEL_KEY = 'last_used_model_id';

export const getLastUsedModelId = async (): Promise<number | null> => {
  const value = await AsyncStorage.getItem(LAST_USED_MODEL_KEY);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const setLastUsedModelId = (id: number) =>
  AsyncStorage.setItem(LAST_USED_MODEL_KEY, String(id));
