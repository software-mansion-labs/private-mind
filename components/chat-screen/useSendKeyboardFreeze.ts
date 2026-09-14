import { useCallback, useEffect, useRef } from 'react';
import {
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { PIN_FREEZE_FALLBACK_MS } from '../../constants/chat-screen';

export const useSendKeyboardFreeze = (
  keyboardLift: SharedValue<number>,
  extraContentPadding: SharedValue<number>
) => {
  const frozen = useSharedValue(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFallback = useCallback(() => {
    if (fallback.current) clearTimeout(fallback.current);
    fallback.current = null;
  }, []);

  const release = useCallback(() => {
    clearFallback();
    frozen.set(false);
  }, [clearFallback, frozen]);

  const arm = useCallback(() => {
    clearFallback();
    frozen.set(true);
    fallback.current = setTimeout(release, PIN_FREEZE_FALLBACK_MS);
  }, [clearFallback, frozen, release]);

  useAnimatedReaction(
    () =>
      frozen.value &&
      keyboardLift.value === 0 &&
      extraContentPadding.value === 0,
    (settled) => {
      if (settled) frozen.value = false;
    }
  );

  useEffect(() => clearFallback, [clearFallback]);

  return { frozen, arm, release };
};
