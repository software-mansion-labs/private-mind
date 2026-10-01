import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { SvgComponent } from '../utils/SvgComponent';
import { pressedOpacity } from '../styles/pressable';

interface Props {
  icon: SvgComponent;
  size?: number;
  backgroundColor: string;
  color: string;
  onPress?: () => void;
  disabled?: boolean;
  dimmed?: boolean;
  busy?: boolean;
  testID?: string;
}

const CircleButton = ({
  icon: Icon,
  size = 20,
  backgroundColor,
  color,
  onPress,
  disabled = false,
  dimmed = false,
  busy = false,
  testID,
}: Props) => {
  const styles = useMemo(
    () => createStyles(backgroundColor),
    [backgroundColor]
  );

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.circle,
        (disabled || dimmed) && styles.dimmed,
        pressed && pressedOpacity,
      ]}
      disabled={disabled}
      accessibilityState={{ disabled, busy }}
      testID={testID}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Icon width={size} height={size} color={color} />
      )}
    </Pressable>
  );
};

export default CircleButton;

const createStyles = (backgroundColor: string) =>
  StyleSheet.create({
    circle: {
      width: 36,
      height: 36,
      padding: 8,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor,
    },
    dimmed: {
      opacity: 0.6,
    },
  });
