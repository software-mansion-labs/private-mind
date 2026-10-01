import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { SvgComponent } from '../../utils/SvgComponent';

const DISABLED_OPACITY = 0.4;

type MessageActionButtonProps = {
  label: string;
  icon: SvgComponent;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
};

export default function MessageActionButton({
  label,
  icon: Icon,
  onPress,
  disabled = false,
  testID,
}: MessageActionButtonProps) {
  const { styles } = useThemedStyles(createStyles);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <Icon width={16} height={16} style={styles.icon} />
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      width: 24,
      height: 24,
      borderRadius: 8,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonPressed: {
      opacity: 0.6,
    },
    buttonDisabled: {
      opacity: DISABLED_OPACITY,
    },
    icon: {
      color: theme.text.primary,
    },
  });
