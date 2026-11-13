import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import {
  pauseDownloadsForBackground,
  resumeDownloadsAfterBackground,
} from '../store/modelStore';
import {
  pauseFeatureDownloadsForBackground,
  resumeFeatureDownloadsAfterBackground,
} from '../utils/featureDownloadsInBackground';

export const useDownloadsSurviveBackground = () => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        pauseDownloadsForBackground();
        pauseFeatureDownloadsForBackground();
      } else if (next === 'active') {
        resumeDownloadsAfterBackground();
        resumeFeatureDownloadsAfterBackground();
      }
    });
    return () => subscription.remove();
  }, []);
};
