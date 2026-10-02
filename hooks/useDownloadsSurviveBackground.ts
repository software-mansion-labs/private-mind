import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import {
  pauseDownloadsForBackground,
  resumeDownloadsAfterBackground,
} from '../store/modelStore';

export const useDownloadsSurviveBackground = () => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') pauseDownloadsForBackground();
      else if (next === 'active') resumeDownloadsAfterBackground();
    });
    return () => subscription.remove();
  }, []);
};
