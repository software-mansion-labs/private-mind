import { act, renderHook } from '@testing-library/react-native';
import type {
  NativeSyntheticEvent,
  Text,
  TextLayoutEventData,
  View,
} from 'react-native';
import { useHeadingAnchor } from '../components/chat-screen/useHeadingAnchor';

const LINE = { x: 0, y: 2, width: 200, height: 40, ascender: 30 };

const textLayout = (lineCount: number) =>
  ({
    nativeEvent: { lines: Array.from({ length: lineCount }, () => LINE) },
  }) as unknown as NativeSyntheticEvent<TextLayoutEventData>;

const renderAnchor = () => {
  const frame = { x: 20, y: 300, width: 240 };
  const container = { current: {} as View };
  const hook = renderHook(
    ({ height }: { height: number }) => useHeadingAnchor(container, height),
    { initialProps: { height: 800 } }
  );
  hook.result.current.textRef.current = {
    measureLayout: (
      _host: unknown,
      onSuccess: (x: number, y: number, width: number) => void
    ) => onSuccess(frame.x, frame.y, frame.width),
  } as unknown as Text;
  return { hook, frame };
};

describe('useHeadingAnchor', () => {
  it('is undecided until the heading text has been laid out', () => {
    const { hook } = renderAnchor();
    hook.rerender({ height: 700 });
    expect(hook.result.current.anchor).toBeUndefined();
  });

  it('anchors the centred line on its baseline', () => {
    const { hook } = renderAnchor();
    act(() => hook.result.current.onTextLayout(textLayout(1)));
    expect(hook.result.current.anchor).toEqual({
      left: 40,
      baseline: 332,
      width: 200,
    });
  });

  it('follows the heading when the container height moves it', () => {
    const { hook, frame } = renderAnchor();
    act(() => hook.result.current.onTextLayout(textLayout(1)));
    frame.y = 250;
    hook.rerender({ height: 700 });
    expect(hook.result.current.anchor?.baseline).toBe(282);
  });

  it('keeps the same anchor when a re-measure changes nothing', () => {
    const { hook } = renderAnchor();
    act(() => hook.result.current.onTextLayout(textLayout(1)));
    const first = hook.result.current.anchor;
    hook.rerender({ height: 700 });
    expect(hook.result.current.anchor).toBe(first);
  });

  it('gives up on a heading that wraps', () => {
    const { hook } = renderAnchor();
    act(() => hook.result.current.onTextLayout(textLayout(2)));
    expect(hook.result.current.anchor).toBeNull();
  });
});
