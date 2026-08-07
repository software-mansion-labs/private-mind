import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import WebSearchTraceRow from './WebSearchTraceRow';
import { type Row } from './webSearchTrace';
import { ROW_INDENT, WEB_TRACE_TRANSITION_MS } from './webSearchTraceConstants';

interface Props {
  expanded: boolean;
  rows: Row[];
  enterDelay: Map<string, number>;
  animateRows: boolean;
  onOpen: (url?: string) => void;
  onOpenChallenge: () => void;
  onCollapsed: () => void;
}

const ACCORDION_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

const WebSearchTraceList = ({
  expanded,
  rows,
  enterDelay,
  animateRows,
  onOpen,
  onOpenChallenge,
  onCollapsed,
}: Props) => {
  const listHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const notifyCollapsed = useCallback(() => {
    if (mountedRef.current) onCollapsed();
  }, [onCollapsed]);

  useEffect(() => {
    if (expanded) {
      if (contentHeight.get() > 0) {
        listHeight.set(
          withTiming(contentHeight.get(), {
            duration: WEB_TRACE_TRANSITION_MS,
            easing: ACCORDION_EASING,
          })
        );
      }
      return;
    }
    listHeight.set(
      withTiming(
        0,
        { duration: WEB_TRACE_TRANSITION_MS, easing: ACCORDION_EASING },
        (finished) => {
          if (finished) runOnJS(notifyCollapsed)();
        }
      )
    );
  }, [expanded, listHeight, contentHeight, notifyCollapsed]);

  const handleListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const next = event.nativeEvent.layout.height;
      if (next <= 0) return;
      contentHeight.set(next);
      if (!expanded) return;
      listHeight.set(
        withTiming(next, {
          duration: WEB_TRACE_TRANSITION_MS,
          easing: ACCORDION_EASING,
        })
      );
    },
    [expanded, listHeight, contentHeight]
  );

  const listClipStyle = useAnimatedStyle(() => ({ height: listHeight.get() }));

  return (
    <Animated.View style={[styles.listClip, listClipStyle]}>
      <View style={styles.list} onLayout={handleListLayout}>
        {rows.map((row, index) => (
          <Animated.View
            key={row.key}
            layout={
              animateRows
                ? LinearTransition.duration(WEB_TRACE_TRANSITION_MS)
                : undefined
            }
            entering={
              animateRows
                ? FadeInDown.duration(WEB_TRACE_TRANSITION_MS).delay(
                    enterDelay.get(row.key) ?? 0
                  )
                : undefined
            }
          >
            <WebSearchTraceRow
              row={row}
              isFirst={index === 0}
              isLast={index === rows.length - 1}
              onOpen={onOpen}
              onOpenChallenge={onOpenChallenge}
            />
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
};

export default WebSearchTraceList;

const styles = StyleSheet.create({
  listClip: {
    marginTop: 6,
    overflow: 'hidden',
  },
  list: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingLeft: ROW_INDENT,
  },
});
