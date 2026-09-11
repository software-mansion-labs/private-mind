import NetInfo from '@react-native-community/netinfo';

const OFFLINE_RETRY_DELAY_MS = 400;

const checkOnce = async (): Promise<boolean> => {
  try {
    const net = await NetInfo.fetch();
    return !(net.isConnected === false && net.isInternetReachable === false);
  } catch {
    return true;
  }
};

export const isDeviceOnline = async (): Promise<boolean> => {
  if (await checkOnce()) return true;
  await new Promise((resolve) => setTimeout(resolve, OFFLINE_RETRY_DELAY_MS));
  return checkOnce();
};
