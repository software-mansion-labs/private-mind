import {
  RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type {
  NativeSyntheticEvent,
  Text,
  TextLayoutEventData,
  TextLayoutLine,
  View,
} from 'react-native';

export interface HeadingAnchor {
  left: number;
  baseline: number;
  width: number;
}

type MeasuredAnchor = HeadingAnchor | null | undefined;

const sameAnchor = (a: MeasuredAnchor, b: MeasuredAnchor) =>
  a === b ||
  (!!a &&
    !!b &&
    a.left === b.left &&
    a.baseline === b.baseline &&
    a.width === b.width);

export const useHeadingAnchor = (
  container: RefObject<View | null>,
  containerHeight: number
) => {
  const textRef = useRef<Text>(null);
  const singleLine = useRef<TextLayoutLine | null | undefined>(undefined);
  const [anchor, setAnchor] = useState<MeasuredAnchor>(undefined);

  const settle = useCallback(
    (next: HeadingAnchor | null) =>
      setAnchor((current) => (sameAnchor(current, next) ? current : next)),
    []
  );

  const measure = useCallback(() => {
    const line = singleLine.current;
    if (line === undefined) return;
    const text = textRef.current;
    const host = container.current;
    if (!line || !text || !host) {
      settle(null);
      return;
    }
    text.measureLayout(
      host,
      (x, y, width) =>
        settle({
          left: x + (width - line.width) / 2,
          baseline: y + line.y + line.ascender,
          width: line.width,
        }),
      () => settle(null)
    );
  }, [container, settle]);

  const onTextLayout = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      const { lines } = event.nativeEvent;
      singleLine.current = lines.length === 1 ? lines[0] : null;
      measure();
    },
    [measure]
  );

  useLayoutEffect(measure, [containerHeight, measure]);

  return { textRef, anchor, onTextLayout };
};
