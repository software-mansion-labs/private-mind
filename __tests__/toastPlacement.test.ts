import { Platform } from 'react-native';
import { toastTopOffset } from '../components/AppToast';

describe('toastTopOffset', () => {
  it('clears the navigation header, not just the status bar', () => {
    const safeAreaTop = 59;

    expect(toastTopOffset(safeAreaTop)).toBeGreaterThan(safeAreaTop + 44);
  });

  it('grows with the safe area', () => {
    expect(toastTopOffset(59) - toastTopOffset(20)).toBe(39);
  });

  it('leaves a gap between the header and the toast', () => {
    const headerBottom = Platform.OS === 'ios' ? 20 + 44 : 20 + 56;

    expect(toastTopOffset(20)).toBe(headerBottom + 8);
  });
});
