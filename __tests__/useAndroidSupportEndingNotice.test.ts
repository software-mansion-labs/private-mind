import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAndroidSupportEndingNotice } from '../hooks/useAndroidSupportEndingNotice';
import { useNoticeStore } from '../store/noticeStore';
import { ANDROID_SUPPORT_ENDING_NOTICE } from '../constants/android-support';

const ORIGINAL_OS = Platform.OS;
const ORIGINAL_VERSION = Platform.Version;

const runOn = (os: string, version: number) => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
  Object.defineProperty(Platform, 'Version', {
    get: () => version,
    configurable: true,
  });
};

const shownIds = () => useNoticeStore.getState().notices.map((n) => n.id);

const settle = () => act(async () => {});

afterEach(async () => {
  runOn(ORIGINAL_OS, ORIGINAL_VERSION as number);
  useNoticeStore.setState({ notices: [] });
  await AsyncStorage.clear();
});

describe('useAndroidSupportEndingNotice', () => {
  it('warns a phone on Android 12 that future versions need Android 13', async () => {
    runOn('android', 32);
    renderHook(() => useAndroidSupportEndingNotice());

    await waitFor(() =>
      expect(shownIds()).toEqual([ANDROID_SUPPORT_ENDING_NOTICE.id])
    );
  });

  it('stays silent on Android 13', async () => {
    runOn('android', 33);
    renderHook(() => useAndroidSupportEndingNotice());
    await settle();

    expect(shownIds()).toEqual([]);
  });

  it('stays silent on iOS', async () => {
    runOn('ios', 17);
    renderHook(() => useAndroidSupportEndingNotice());
    await settle();

    expect(shownIds()).toEqual([]);
  });

  it('does not come back on the next launch once dismissed', async () => {
    runOn('android', 31);
    const firstLaunch = renderHook(() => useAndroidSupportEndingNotice());
    await waitFor(() => expect(shownIds()).toHaveLength(1));

    const [notice] = useNoticeStore.getState().notices;
    act(() => useNoticeStore.getState().dismissNotice(notice!));
    await settle();
    firstLaunch.unmount();

    renderHook(() => useAndroidSupportEndingNotice());
    await settle();

    expect(shownIds()).toEqual([]);
  });
});
