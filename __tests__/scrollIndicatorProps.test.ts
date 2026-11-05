import { Platform } from 'react-native';
import { scrollIndicatorProps } from '../constants/scroll-indicator';

const ORIGINAL_OS = Platform.OS;
const setPlatform = (os: string) =>
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });

afterEach(() => setPlatform(ORIGINAL_OS));

describe('scrollIndicatorProps', () => {
  it('hides the indicator on Android, which cannot inset it', () => {
    setPlatform('android');

    expect(scrollIndicatorProps(100, 200)).toEqual({
      showsVerticalScrollIndicator: false,
    });
  });

  it('keeps an inset indicator on iOS', () => {
    setPlatform('ios');

    const props = scrollIndicatorProps(100, 200);

    expect(props).not.toHaveProperty('showsVerticalScrollIndicator');
    expect(props).toMatchObject({
      scrollIndicatorInsets: { top: 100, bottom: 200 },
    });
  });
});
