import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { SvgComponent } from '../utils/SvgComponent';

interface Props {
  icon: SvgComponent;
  size?: number;
  backgroundColor: string;
  color: string;
  onPress?: () => void;
  disabled?: boolean;
}

const CircleButton = ({
  icon: Icon,
  size = 20,
  backgroundColor,
  color,
  onPress,
  disabled = false,
}: Props) => {
  const styles = useMemo(
    () => createStyles(backgroundColor),
    [backgroundColor]
  );

  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      style={styles.circle}
      disabled={disabled}
    >
      <Icon width={size} height={size} color={color} />
    </TouchableOpacity>
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
  });
