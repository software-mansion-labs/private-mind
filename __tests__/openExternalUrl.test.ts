import * as WebBrowser from 'expo-web-browser';
import Toast from 'react-native-toast-message';
import { openExternalUrl } from '../utils/web/openExternalUrl';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

const openBrowserAsync = WebBrowser.openBrowserAsync as jest.Mock;
const toast = Toast.show as jest.Mock;

describe('openExternalUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    openBrowserAsync.mockResolvedValue(undefined);
  });

  it('opens an http and an https page', () => {
    openExternalUrl('https://example.com/a');
    openExternalUrl('http://example.com/b');
    expect(openBrowserAsync.mock.calls).toEqual([
      ['https://example.com/a'],
      ['http://example.com/b'],
    ]);
    expect(toast).not.toHaveBeenCalled();
  });

  const REFUSED = [
    'javascript:alert(1)',
    'intent://scan/#Intent;scheme=zxing;end',
    'file:///etc/passwd',
    'content://com.android.providers/1',
    'data:text/html,<script>alert(1)</script>',
    'mailto:someone@example.com',
    'app-scheme://open',
    ' https://example.com',
    '',
  ];

  it.each(REFUSED)('refuses %p', (url) => {
    openExternalUrl(url);
    expect(openBrowserAsync).not.toHaveBeenCalled();
  });

  it('refuses a url that is missing altogether', () => {
    openExternalUrl(undefined);
    expect(openBrowserAsync).not.toHaveBeenCalled();
  });

  it('says so rather than looking like a dead button when it refuses', () => {
    openExternalUrl('javascript:alert(1)');
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('says so when the device has nothing that can open the page', async () => {
    openBrowserAsync.mockRejectedValue(new Error('NoMatchingActivity'));
    openExternalUrl('https://example.com');
    await Promise.resolve();
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
