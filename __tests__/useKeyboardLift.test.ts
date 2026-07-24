import { renderHook } from '@testing-library/react-native';
import { useKeyboardLift } from '../components/chat-screen/useKeyboardLift';

let mockInsetsBottom = 0;
const mockHeight = { value: 0 };
const mockProgress = { value: 0 };

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      insets: { top: 0, bottom: mockInsetsBottom, left: 0, right: 0 },
    },
  }),
}));

jest.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => ({
    height: mockHeight,
    progress: mockProgress,
  }),
}));

describe('useKeyboardLift', () => {
  beforeEach(() => {
    mockHeight.value = 0;
    mockProgress.value = 0;
    mockInsetsBottom = 0;
  });

  it('returns 0 when the keyboard is closed', () => {
    const { result } = renderHook(() => useKeyboardLift());

    expect(result.current.value).toBe(0);
  });

  it('gives back the bottom inset the open keyboard swallows', () => {
    mockInsetsBottom = 34;
    mockHeight.value = -346;
    mockProgress.value = 1;

    const { result } = renderHook(() => useKeyboardLift());

    expect(result.current.value).toBe(-312);
  });

  it('scales the inset compensation with keyboard progress', () => {
    mockInsetsBottom = 34;
    mockHeight.value = -173;
    mockProgress.value = 0.5;

    const { result } = renderHook(() => useKeyboardLift());

    expect(result.current.value).toBe(-156);
  });

  it('equals the raw keyboard height on a device without a bottom inset', () => {
    mockHeight.value = -300;
    mockProgress.value = 1;

    const { result } = renderHook(() => useKeyboardLift());

    expect(result.current.value).toBe(-300);
  });

  it('recomputes after the keyboard values change', () => {
    mockInsetsBottom = 34;
    const { result, rerender } = renderHook(() => useKeyboardLift());

    expect(result.current.value).toBe(0);

    mockHeight.value = -346;
    mockProgress.value = 1;
    rerender({});

    expect(result.current.value).toBe(-312);
  });
});
