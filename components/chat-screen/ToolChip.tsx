import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme, withAlpha } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { SvgComponent } from '../../utils/SvgComponent';
import { Feedback } from '../../utils/Feedback';
import CrossIcon from '../../assets/icons/cross-small.svg';
import {
  controlHeight,
  hitSlop,
  iconSize,
  opacity,
  radius,
  space,
} from '../../constants/design-system';

const CHIP_FADE_MS = 160;
const CHIP_TINT_ALPHA = 0.12;

interface Props {
  label: string;
  icon: SvgComponent;
  onTurnOff: () => void;
  testID?: string;
}

const ToolChip = ({ label, icon: Icon, onTurnOff, testID }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  const handlePress = () => {
    Feedback.toggleOff();
    onTurnOff();
  };

  return (
    <Animated.View
      entering={FadeIn.duration(CHIP_FADE_MS)}
      exiting={FadeOut.duration(CHIP_FADE_MS)}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`Turn off ${label}`}
        hitSlop={{ top: hitSlop / 2, bottom: hitSlop / 2 }}
        onPress={handlePress}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      >
        <Icon
          width={iconSize.sm}
          height={iconSize.sm}
          style={{ color: theme.text.onChatBar }}
        />
        <Text numberOfLines={1} style={styles.label}>
          {label}
        </Text>
        <CrossIcon
          width={iconSize.sm}
          height={iconSize.sm}
          style={{ color: theme.text.onChatBarMuted }}
        />
      </Pressable>
    </Animated.View>
  );
};

export default ToolChip;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    chip: {
      height: controlHeight.pill,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.one,
      paddingLeft: space.three,
      paddingRight: space.twoHalf,
      borderRadius: radius.full,
      backgroundColor: withAlpha(theme.text.onChatBar, CHIP_TINT_ALPHA),
    },
    pressed: {
      opacity: opacity.pressed,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.onChatBar,
    },
  });
