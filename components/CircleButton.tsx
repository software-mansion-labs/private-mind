import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { SvgComponent } from '../utils/SvgComponent';

interface Props {
  icon: SvgComponent;
  size?: number;
  backgroundColor: string;
  borderColor?: string;
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
  borderColor,
  color,
  onPress,
  disabled = false,
  dimmed = false,
  busy = false,
  testID,
}: Props) => {
  const styles = useMemo(
    () => createStyles(backgroundColor, borderColor),
    [backgroundColor, borderColor]
  );

  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      style={[styles.circle, (disabled || dimmed) && styles.dimmed]}
      disabled={disabled}
      accessibilityState={{ disabled, busy }}
      testID={testID}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Icon width={size} height={size} color={color} />
      )}
    </TouchableOpacity>
  );
};

export default CircleButton;

const createStyles = (backgroundColor: string, borderColor?: string) =>
  StyleSheet.create({
    circle: {
      width: 36,
      height: 36,
      padding: 8,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor,
      ...(borderColor ? { borderWidth: 1, borderColor } : null),
    },
    dimmed: {
      opacity: 0.6,
    },
  });
