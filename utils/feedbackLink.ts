import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Device from 'expo-device';

export const FEEDBACK_ISSUES_URL =
  'https://github.com/software-mansion-labs/private-mind/issues/new';

export interface FeedbackContext {
  appVersion: string;
  platform: string;
  osVersion: string;
  deviceModel: string;
}

export const buildFeedbackUrl = (context: FeedbackContext): string => {
  const body = [
    'What happened, or what would you like to see?',
    '',
    '',
    '---',
    `App: ${context.appVersion}`,
    `Device: ${context.deviceModel} (${context.platform} ${context.osVersion})`,
  ].join('\n');
  const query = `title=${encodeURIComponent('Feedback: ')}&body=${encodeURIComponent(body)}`;
  return `${FEEDBACK_ISSUES_URL}?${query}`;
};

export const currentFeedbackContext = (): FeedbackContext => ({
  appVersion: Application.nativeApplicationVersion ?? 'unknown',
  platform: Platform.OS,
  osVersion: String(Platform.Version),
  deviceModel: Device.modelName ?? 'unknown device',
});

export const openFeedback = async (): Promise<void> => {
  try {
    await Linking.openURL(buildFeedbackUrl(currentFeedbackContext()));
  } catch (error) {
    console.warn('Opening the feedback page failed', error);
  }
};
