import type { AppNotice } from '../store/noticeStore';

export const ANDROID_13_API_LEVEL = 33;

export const ANDROID_SUPPORT_ENDING_NOTICE: Omit<AppNotice, 'onDismiss'> = {
  id: 'android-support-ending',
  title: 'Updates will need Android 13',
  message:
    "Future versions won't install on Android 12 or older. This version keeps working on your phone, but it won't get new features or fixes.",
};
