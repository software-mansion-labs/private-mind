import React, { RefObject } from 'react';
import {
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextLayoutEventData,
} from 'react-native';
import Animated, {
  FadeOut,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { space, textStyles } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import {
  NEW_CHAT_HEADING,
  NEW_CHAT_REST_BOTTOM_FRACTION,
} from '../../constants/chat-screen';
import WhatsNewBadge from '../WhatsNewBadge';
import { GUTTER } from './attachments/constants';
import { GRADIENT_EXIT_MS } from './gradientHandoff';

const GAP_ABOVE_BAR = space.four;

export const heroPushUp = (barTop: number, restBottom: number): number => {
  'worklet';
  return Math.min(0, barTop - GAP_ABOVE_BAR - restBottom);
};

interface Props {
  screenHeight: number;
  barHeight: SharedValue<number>;
  keyboardLift: SharedValue<number>;
  onWhatsNewOpenChange?: (open: boolean) => void;
  headingRef?: RefObject<Text | null>;
  onHeadingLayout?: (event: NativeSyntheticEvent<TextLayoutEventData>) => void;
  headingReveal?: SharedValue<number>;
  badgeReveal?: SharedValue<number>;
}

const NewChatHero = ({
  screenHeight,
  barHeight,
  keyboardLift,
  onWhatsNewOpenChange,
  headingRef,
  onHeadingLayout,
  headingReveal,
  badgeReveal,
}: Props) => {
  const restBottom = screenHeight * NEW_CHAT_REST_BOTTOM_FRACTION;
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

  const revealStyle = useAnimatedStyle(() => ({
    opacity: headingReveal ? headingReveal.get() : 1,
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeReveal ? badgeReveal.get() : 1,
  }));

  return (
    <Animated.View
      style={[styles.container, pushStyle]}
      exiting={FadeOut.duration(GRADIENT_EXIT_MS)}
      pointerEvents="box-none"
      testID="new-chat-hero"
    >
      <Animated.View style={badgeStyle}>
        <WhatsNewBadge onSheetOpenChange={onWhatsNewOpenChange} />
      </Animated.View>
      <Animated.Text
        ref={headingRef}
        style={[styles.heading, revealStyle]}
        accessibilityRole="header"
        maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
        onTextLayout={onHeadingLayout}
      >
        {NEW_CHAT_HEADING}
      </Animated.Text>
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
