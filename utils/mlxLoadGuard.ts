import AsyncStorage from '@react-native-async-storage/async-storage';

const LOAD_IN_FLIGHT_KEY = 'mlx_model_load_in_flight';
const LOAD_DEATHS_KEY = 'mlx_model_load_deaths';

export const markMlxLoadStarted = (modelId: number): Promise<void> =>
  AsyncStorage.setItem(LOAD_IN_FLIGHT_KEY, String(modelId));

export const markMlxLoadSettled = (): Promise<void> =>
  AsyncStorage.removeItem(LOAD_IN_FLIGHT_KEY);

const loadDeathsSoFar = async (): Promise<number> =>
  Number((await AsyncStorage.getItem(LOAD_DEATHS_KEY)) ?? 0);

export const takeModelThatDiedLoading = async (): Promise<number | null> => {
  const inFlight = await AsyncStorage.getItem(LOAD_IN_FLIGHT_KEY);
  if (inFlight === null) return null;
  await AsyncStorage.removeItem(LOAD_IN_FLIGHT_KEY);
  await AsyncStorage.setItem(
    LOAD_DEATHS_KEY,
    String((await loadDeathsSoFar()) + 1)
  );
  const modelId = Number(inFlight);
  return Number.isInteger(modelId) ? modelId : null;
};
