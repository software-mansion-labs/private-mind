import { act, renderHook } from '@testing-library/react-native';
import { lightTheme } from '../styles/colors';
import { useChatScreenLayout } from '../components/chat-screen/useChatScreenLayout';

const theme = {
  ...lightTheme,
  insets: { top: 59, bottom: 34, left: 0, right: 0 },
};

type AnimatedStyleShape = { opacity: number; transform?: unknown[] };

const styleOf = (handle: unknown) => handle as AnimatedStyleShape;

const layoutFor = (isEmpty: boolean) =>
  renderHook(() => useChatScreenLayout({ isEmpty, headerHeight: 103, theme }))
    .result.current;

describe('useChatScreenLayout', () => {
  it('knows the screen size on a remount, so the heading never skips a frame', () => {
    const { result } = renderHook(() =>
      useChatScreenLayout({ isEmpty: true, headerHeight: 103, theme })
    );
    (result.current.rootRef as { current: unknown }).current = {
      measureInWindow: (
        callback: (x: number, y: number, w: number, h: number) => void
      ) => callback(0, 0, 402, 874),
    };
    act(() => result.current.handleRootLayout());

    expect(layoutFor(true).rootFrame.height).toBe(874);
  });

  it('tints the header with the same progress that fades the gradient', () => {
    const { gradientStyle, topFadeStyle } = layoutFor(true);

    expect(styleOf(topFadeStyle).opacity).toBe(styleOf(gradientStyle).opacity);
  });

  it('keeps the tint mounted for as long as the gradient', () => {
    expect(layoutFor(true).showGradient).toBe(true);
  });

  it('settles the gradient at rest once it has arrived', () => {
    const { gradientStyle } = layoutFor(true);

    expect(styleOf(gradientStyle).opacity).toBe(1);
    expect(styleOf(gradientStyle).transform).toEqual([
      { translateY: 0 },
      { scale: 1 },
    ]);
  });
});
