import { useCallback, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { NEW_CHAT_COLLAPSE_DURATION } from '../../constants/drawer-layout';
import { isNewChatCollapsed } from './newChatCollapse';

export const useNewChatCollapse = () => {
  const newChatCollapse = useSharedValue(0);
  const collapsedRef = useRef(false);

  const trackScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      const collapsed = isNewChatCollapsed({
        offset: nativeEvent.contentOffset.y,
        contentHeight: nativeEvent.contentSize.height,
        viewportHeight: nativeEvent.layoutMeasurement.height,
      });
      if (collapsed === collapsedRef.current) return;
      collapsedRef.current = collapsed;
      newChatCollapse.set(
        withTiming(collapsed ? 1 : 0, {
          duration: NEW_CHAT_COLLAPSE_DURATION,
        })
      );
    },
    [newChatCollapse]
  );

  return { newChatCollapse, trackScroll };
};
