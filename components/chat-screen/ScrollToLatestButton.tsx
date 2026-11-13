import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Reanimated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import ChevronDown from '../../assets/icons/chevron-down.svg';
import { useTheme } from '../../context/ThemeContext';
import { Feedback } from '../../utils/Feedback';
import { Glass } from '../Glass';

export const SCROLL_BUTTON_ENTER_MS = 240;
export const SCROLL_BUTTON_EXIT_MS = 140;
const HIDDEN_SCALE = 0.6;
const HIDDEN_DRIFT_PX = 10;
const PRESSED_SCALE = 0.88;
const BUTTON_SIZE = 40;

interface Props {
  visible: boolean;
  onPress: () => void;
}

const ScrollToLatestButton = ({ visible, onPress }: Props) => {
  const { theme } = useTheme();
  const shown = useSharedValue(visible ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    shown.set(
      visible
        ? withTiming(1, {
            duration: SCROLL_BUTTON_ENTER_MS,
            easing: Easing.out(Easing.back(1.8)),
          })
        : withTiming(0, {
            duration: SCROLL_BUTTON_EXIT_MS,
            easing: Easing.in(Easing.quad),
          })
    );
  }, [shown, visible]);

  const animatedStyle = useAnimatedStyle(() => {
    const entrance = shown.get();
    return {
      opacity: Math.min(1, entrance * 1.6),
      transform: [
        { translateY: interpolate(entrance, [0, 1], [HIDDEN_DRIFT_PX, 0]) },
        {
          scale:
            interpolate(entrance, [0, 1], [HIDDEN_SCALE, 1]) *
            interpolate(pressed.get(), [0, 1], [1, PRESSED_SCALE]),
        },
      ],
    };
  });

  return (
    <Reanimated.View
      style={[styles.button, animatedStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'yes' : 'no-hide-descendants'}
      testID="scroll-to-latest-shell"
    >
      <Glass radius={BUTTON_SIZE / 2} style={styles.glass}>
        <Pressable
          style={styles.hitArea}
          onPressIn={() => pressed.set(withTiming(1, { duration: 90 }))}
          onPressOut={() =>
            pressed.set(
              withSpring(0, { damping: 11, stiffness: 340, mass: 0.4 })
            )
          }
          onPress={() => {
            Feedback.scrollToLatest();
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel="Scroll to latest message"
          testID="scroll-to-latest"
        >
          <ChevronDown
            width={20}
            height={20}
            style={{ color: theme.text.primary }}
          />
        </Pressable>
      </Glass>
    </Reanimated.View>
  );
};

export default ScrollToLatestButton;

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  glass: {
    flex: 1,
  },
  hitArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
