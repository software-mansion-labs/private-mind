import React, { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { SvgComponent } from '../../utils/SvgComponent';

type MessageActionButtonProps = {
  label: string;
  icon: SvgComponent;
  onPress?: () => void;
};

export default function MessageActionButton({
  label,
  icon: Icon,
  onPress,
}: MessageActionButtonProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
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
    icon: {
      color: theme.text.primary,
    },
  });
