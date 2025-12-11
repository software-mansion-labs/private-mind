import { type Config } from '@swmansion/react-native-detour';
import Constants from 'expo-constants';

/**
 * Detour SDK configuration object.
 * Docs: https://docs.swmansion.com/detour/docs/SDK/sdk-usage
 */
export const detourConfig: Config = {
  /**
   * Your API key from the Detour dashboard
   */
  API_KEY:
    process.env.EXPO_PUBLIC_DETOUR_API_KEY ||
    Constants.expoConfig?.extra?.detourApiKey ||
    '',
  /**
   * Your application ID from the Detour dashboard
   */
  appID:
    process.env.EXPO_PUBLIC_DETOUR_APP_ID ||
    Constants.expoConfig?.extra?.detourAppId ||
    '',
  /**
   * Optional: A flag to determine if the provider should check the clipboard for a deferred link.
   * When true, it displays permission alert to user.
   * Defaults to true if not provided.
   */
  shouldUseClipboard: true,
};
