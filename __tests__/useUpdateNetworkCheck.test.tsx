import { Alert, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { act, renderHook } from '@testing-library/react-native';
import { useUpdateNetworkCheck } from '../hooks/useUpdateNetworkCheck';
import { MODEL_UPDATE_TEXT } from '../constants/model-update';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
}));

const mockFetch = NetInfo.fetch as jest.Mock;

const onNetwork = (isConnected: boolean, type: string) =>
  mockFetch.mockResolvedValue({ isConnected, type });

const answerAlert = (confirm: boolean) =>
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    const button = buttons?.[confirm ? 1 : 0];
    button?.onPress?.();
  });

beforeEach(() => {
  jest.restoreAllMocks();
  Platform.OS = 'ios';
});

describe('checking the network before a model update', () => {
  it('stops an offline update and says why', async () => {
    onNetwork(false, 'none');
    const toast = jest.spyOn(Toast, 'show');
    const { result } = renderHook(() => useUpdateNetworkCheck());

    let allowed = true;
    await act(async () => {
      allowed = await result.current.canDownload(1.5);
    });

    expect(allowed).toBe(false);
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ text1: MODEL_UPDATE_TEXT.offline })
    );
  });

  it('lets the update through on Wi-Fi without asking', async () => {
    onNetwork(true, 'wifi');
    const alert = jest.spyOn(Alert, 'alert');
    const { result } = renderHook(() => useUpdateNetworkCheck());

    let allowed = false;
    await act(async () => {
      allowed = await result.current.canDownload(1.5);
    });

    expect(allowed).toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });

  it('asks before an update over mobile data and names its size', async () => {
    onNetwork(true, 'cellular');
    const alert = answerAlert(true);
    const { result } = renderHook(() => useUpdateNetworkCheck());

    let allowed = false;
    await act(async () => {
      allowed = await result.current.canDownload(5.4);
    });

    expect(allowed).toBe(true);
    expect(alert).toHaveBeenCalledWith(
      MODEL_UPDATE_TEXT.mobileDataTitle,
      MODEL_UPDATE_TEXT.mobileDataMessage(5.4),
      expect.any(Array)
    );
  });

  it('does not download over mobile data when the user declines', async () => {
    onNetwork(true, 'cellular');
    answerAlert(false);
    const { result } = renderHook(() => useUpdateNetworkCheck());

    let allowed = true;
    await act(async () => {
      allowed = await result.current.canDownload(5.4);
    });

    expect(allowed).toBe(false);
  });
});
