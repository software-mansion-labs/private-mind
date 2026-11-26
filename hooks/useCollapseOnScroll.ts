import { useCallback, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { SCROLL_COLLAPSE_DURATION } from '../constants/motion';
import { isScrolledPastTop } from '../utils/scrollCollapse';

export const useCollapseOnScroll = () => {
  const collapse = useSharedValue(0);
  const collapsedRef = useRef(false);

  const trackScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      const collapsed = isScrolledPastTop({
        offset: nativeEvent.contentOffset.y,
        contentHeight: nativeEvent.contentSize.height,
        viewportHeight: nativeEvent.layoutMeasurement.height,
      });
      if (collapsed === collapsedRef.current) return;
      collapsedRef.current = collapsed;
      collapse.set(
        withTiming(collapsed ? 1 : 0, {
          duration: SCROLL_COLLAPSE_DURATION,
        })
      );
    },
    [collapse]
  );

  return { collapse, trackScroll };
};
