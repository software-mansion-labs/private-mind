import { LegendListRef } from '@legendapp/list';
import {
  useSharedValue,
  SharedValue,
  AnimatedRef,
} from 'react-native-reanimated';
import { useAnimatedReaction } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export function useInitialScrollToEnd(
  blankSize: SharedValue<number>,
  isLoading: boolean,
  listRef: AnimatedRef<LegendListRef>
) {
  const hasStartedScrolledToEnd = useSharedValue(false);
  const hasScrolledToEnd = useSharedValue(false);

  const scrollToEndJS = () => {
    listRef.current?.scrollToEnd({ animated: false });

    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: false });

      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
        hasScrolledToEnd.value = true;
      });
    }, 16);
  };

  useAnimatedReaction(
    () => {
      if (hasStartedScrolledToEnd.value || !isLoading) {
        return false;
      }

      // Scroll when blank size is stable for at least 3 frames
      return blankSize.value > 1;
    },
    (shouldScroll) => {
      if (shouldScroll) {
        hasStartedScrolledToEnd.value = true;
        scheduleOnRN(scrollToEndJS);
      }
    }
  );

  return hasScrolledToEnd;
}
