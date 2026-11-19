import { useEffect } from 'react';
import { useNoticeStore } from '../store/noticeStore';
import { ANDROID_SUPPORT_ENDING_NOTICE } from '../constants/android-support';
import {
  rememberSupportNoticeDismissed,
  runsAndroidOlderThan13,
  wasSupportNoticeDismissed,
} from '../utils/androidSupport';

export const useAndroidSupportEndingNotice = () => {
  const showNotice = useNoticeStore((state) => state.showNotice);

  useEffect(() => {
    if (!runsAndroidOlderThan13()) return;
    wasSupportNoticeDismissed().then((dismissed) => {
      if (dismissed) return;
      showNotice({
        ...ANDROID_SUPPORT_ENDING_NOTICE,
        onDismiss: rememberSupportNoticeDismissed,
      });
    });
  }, [showNotice]);
};
