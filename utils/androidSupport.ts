import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ANDROID_13_API_LEVEL } from '../constants/android-support';

const SUPPORT_NOTICE_DISMISSED_KEY = 'android_support_notice_dismissed';

export const runsAndroidOlderThan13 = () =>
  Platform.OS === 'android' && Number(Platform.Version) < ANDROID_13_API_LEVEL;

export const wasSupportNoticeDismissed = async () =>
  (await AsyncStorage.getItem(SUPPORT_NOTICE_DISMISSED_KEY)) === '1';

export const rememberSupportNoticeDismissed = () =>
  AsyncStorage.setItem(SUPPORT_NOTICE_DISMISSED_KEY, '1');
