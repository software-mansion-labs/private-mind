import { useEffect } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import {
  useKeyboardHandler,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import { useTheme } from '../../context/ThemeContext';
import { bottomBarPadding } from '../../constants/design-system';
import { COMPOSER } from './attachments/constants';
import {
  selectKeyboardOwnedElsewhere,
  useKeyboardOwnerStore,
} from '../../store/keyboardOwnerStore';

const settledValuesJumpAhead = Platform.OS === 'ios';

export const useKeyboardLift = () => {
  const { height, progress } = useReanimatedKeyboardAnimation();
  const frameHeight = useSharedValue(height.value);
  const frameProgress = useSharedValue(progress.value);
  const followsFrames = useSharedValue(false);
  const insetsBottom = useTheme().theme.insets.bottom;
  const keyboardGone = useSharedValue(false);

  // Worklet: sending a message blocks the JS thread past the keyboard's hide.
  useKeyboardHandler(
    {
      // iOS reports keyboardDidShow only once the animation has finished.
      onStart: (event) => {
        'worklet';
        if (event.height !== 0) keyboardGone.value = false;
        followsFrames.value = settledValuesJumpAhead;
      },
      onMove: (event) => {
        'worklet';
        if (event.height !== 0) keyboardGone.value = false;
        frameHeight.value = -Math.abs(event.height);
        frameProgress.value = event.progress;
      },
      onEnd: (event) => {
        'worklet';
        keyboardGone.value = event.height === 0;
        frameHeight.value = -Math.abs(event.height);
        frameProgress.value = event.progress;
        followsFrames.value = false;
      },
    },
    []
  );

  // Catches an unanimated hide the keyboard controller does not report.
  useEffect(() => {
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboardGone.value = true;
      followsFrames.value = false;
    });
    const shown = Keyboard.addListener('keyboardDidShow', () => {
      keyboardGone.value = false;
      followsFrames.value = false;
    });
    const foreground = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !Keyboard.isVisible()) keyboardGone.value = true;
    });
    return () => {
      hidden.remove();
      shown.remove();
      foreground.remove();
    };
  }, [keyboardGone, followsFrames]);

  const keyboardOwnedElsewhere = useKeyboardOwnerStore(
    selectKeyboardOwnedElsewhere
  );

  const restToKeyboardShift =
    bottomBarPadding(insetsBottom) - COMPOSER.keyboardGap;

  return useDerivedValue(() => {
    if (keyboardOwnedElsewhere || keyboardGone.value) return 0;
    return followsFrames.value
      ? frameHeight.value + frameProgress.value * restToKeyboardShift
      : height.value + progress.value * restToKeyboardShift;
  }, [restToKeyboardShift, keyboardOwnedElsewhere]);
};
