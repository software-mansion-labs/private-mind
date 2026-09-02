import React, { useMemo } from 'react';
import { StyleSheet, type ViewProps } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import Animated, { type AnimatedProps } from 'react-native-reanimated';
import { SvgComponent } from '../utils/SvgComponent';

interface Props {
  icon: SvgComponent;
  size?: number;
  backgroundColor: string;
  color: string;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  /** Applied to the glyph alone, so it can move while the hit target stays. */
  iconStyle?: AnimatedProps<ViewProps>['style'];
}

const CircleButton = ({
  icon: Icon,
  size = 20,
  backgroundColor,
  color,
  onPress,
  disabled = false,
  testID,
  iconStyle,
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
      testID={testID}
    >
      <Animated.View style={iconStyle}>
        <Icon width={size} height={size} color={color} />
      </Animated.View>
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
    pressed: {
      opacity: 0.6,
    },
  });
