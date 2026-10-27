import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { SvgComponent } from '../utils/SvgComponent';
import { dimmedOpacity, pressedOpacity } from '../styles/pressable';
import { radius, space, stroke } from '../constants/design-system';

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
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.circle,
        (disabled || dimmed) && dimmedOpacity,
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

const createStyles = (backgroundColor: string, borderColor?: string) =>
  StyleSheet.create({
    circle: {
      width: 36,
      height: 36,
      padding: space.two,
      borderRadius: radius.eighteen,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor,
      ...(borderColor ? { borderWidth: stroke.soft, borderColor } : null),
    },
  });
