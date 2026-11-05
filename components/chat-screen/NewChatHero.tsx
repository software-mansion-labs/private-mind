import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { space, textStyles } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { NEW_CHAT_HEADING } from '../../constants/chat-screen';
import WhatsNewBadge from '../WhatsNewBadge';
import { GUTTER } from './attachments/constants';

const REST_BOTTOM_FRACTION = 0.405;
const GAP_ABOVE_BAR = space.four;

export const heroPushUp = (barTop: number, restBottom: number): number => {
  'worklet';
  return Math.min(0, barTop - GAP_ABOVE_BAR - restBottom);
};

interface Props {
  screenHeight: number;
  barHeight: SharedValue<number>;
  keyboardLift: SharedValue<number>;
}

const NewChatHero = ({ screenHeight, barHeight, keyboardLift }: Props) => {
  const restBottom = screenHeight * REST_BOTTOM_FRACTION;
  const { styles } = useThemedStyles(createStyles, screenHeight - restBottom);

  const pushStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: heroPushUp(
          screenHeight - barHeight.get() + keyboardLift.get(),
          restBottom
        ),
      },
    ],
  }));

  return (
    <Animated.View
      style={[styles.container, pushStyle]}
      pointerEvents="box-none"
      testID="new-chat-hero"
    >
      <WhatsNewBadge />
      <Text
        style={styles.heading}
        accessibilityRole="header"
        maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
      >
        {NEW_CHAT_HEADING}
      </Text>
    </Animated.View>
  );
};

export default NewChatHero;

const createStyles = (theme: Theme, distanceFromBottom: number) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: GUTTER,
      right: GUTTER,
      bottom: distanceFromBottom,
      alignItems: 'center',
      gap: space.four,
      zIndex: 1,
      elevation: 1,
    },
    heading: {
      ...textStyles.titleH1,
      color: theme.text.primary,
      textAlign: 'center',
    },
  });
