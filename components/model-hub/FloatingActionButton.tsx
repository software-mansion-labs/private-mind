import React from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import PlusIcon from '../../assets/icons/plus.svg';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { space } from '../../constants/design-system';
import CollapsibleLabel from '../CollapsibleLabel';

const BUTTON_SIZE = 56;
const ICON_SIZE = 18;
const PADDING_LEFT = 20;
const PADDING_RIGHT = 24;
const COLLAPSED_PADDING = (BUTTON_SIZE - ICON_SIZE) / 2;
const ESTIMATED_LABEL_WIDTH = 82;

interface Props {
  label: string;
  onPress: () => void;
  collapse?: SharedValue<number>;
  disabled?: boolean;
  testID?: string;
}

const FloatingActionButton = ({
  label,
  onPress,
  collapse,
  disabled = false,
  testID,
}: Props) => {
  const { styles } = useThemedStyles(createStyles, disabled);
  const expanded = useSharedValue(0);
  const progress = collapse ?? expanded;

  const contentStyle = useAnimatedStyle(() => ({
    paddingLeft: interpolate(
      progress.get(),
      [0, 1],
      [PADDING_LEFT, COLLAPSED_PADDING]
    ),
    paddingRight: interpolate(
      progress.get(),
      [0, 1],
      [PADDING_RIGHT, COLLAPSED_PADDING]
    ),
  }));

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && pressedOpacity]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <Animated.View style={[styles.content, contentStyle]}>
        <PlusIcon width={ICON_SIZE} height={ICON_SIZE} style={styles.icon} />
        <CollapsibleLabel
          text={label}
          collapse={progress}
          gap={space.two}
          estimatedWidth={ESTIMATED_LABEL_WIDTH}
          textStyle={styles.label}
        />
      </Animated.View>
    </Pressable>
  );
};

export default FloatingActionButton;

const createStyles = (theme: Theme, disabled: boolean) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      right: 20,
      bottom: 16 + theme.insets.bottom,
      height: BUTTON_SIZE,
      borderRadius: BUTTON_SIZE / 2,
      backgroundColor: disabled ? theme.text.defaultTertiary : theme.bg.main,
    },
    content: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    icon: {
      color: disabled
        ? theme.text.defaultSecondary
        : theme.text.contrastPrimary,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: disabled
        ? theme.text.defaultSecondary
        : theme.text.contrastPrimary,
    },
  });
