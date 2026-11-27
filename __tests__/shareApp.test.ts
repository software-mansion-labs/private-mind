import { Share } from 'react-native';
import { APP_SITE_URL, SHARE_APP_MESSAGE, shareApp } from '../utils/shareApp';

describe('sharing the app from Settings', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('offers a message that carries the site link', async () => {
    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.dismissedAction });

    await shareApp();

    expect(share).toHaveBeenCalledWith({ message: SHARE_APP_MESSAGE });
    expect(SHARE_APP_MESSAGE).toContain(APP_SITE_URL);
  });

  it('reports a completed share as shared and a dismissed sheet as not', async () => {
    const share = jest.spyOn(Share, 'share');

    share.mockResolvedValueOnce({ action: Share.sharedAction });
    expect(await shareApp()).toBe(true);

    share.mockResolvedValueOnce({ action: Share.dismissedAction });
    expect(await shareApp()).toBe(false);
  });

  it('swallows a failure of the share sheet', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('no activity'));

    expect(await shareApp()).toBe(false);
  });
});
