import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { SvgComponent } from '../../utils/SvgComponent';
import {
  hitSlop,
  iconSize,
  opacity,
  radius,
} from '../../constants/design-system';

type MessageActionButtonProps = {
  label: string;
  icon: SvgComponent;
  onPress?: () => void;
  testID?: string;
};

export default function MessageActionButton({
  label,
  icon: Icon,
  onPress,
  testID,
}: MessageActionButtonProps) {
  const { styles } = useThemedStyles(createStyles);

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Icon width={iconSize.sm} height={iconSize.sm} style={styles.icon} />
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      width: 24,
      height: 24,
      borderRadius: radius.six,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonPressed: {
      opacity: opacity.pressed,
    },
    icon: {
      color: theme.text.primary,
    },
  });
