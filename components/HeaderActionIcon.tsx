import React, { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';
import {
  dimOpacity,
  HEADER_DIM_IN_MS,
  HEADER_DIM_OUT_MS,
} from '../constants/header-actions';

interface Props {
  icon: React.FC<SvgProps>;
  width: number;
  height: number;
  color: string;
  dimmed: boolean;
  style?: StyleProp<ViewStyle>;
}

const HeaderActionIcon = ({
  icon: Icon,
  width,
  height,
  color,
  dimmed,
  style,
}: Props) => {
  const progress = useSharedValue(dimmed ? 1 : 0);

  useEffect(() => {
    progress.set(
      withTiming(dimmed ? 1 : 0, {
        duration: dimmed ? HEADER_DIM_IN_MS : HEADER_DIM_OUT_MS,
      })
    );
  }, [dimmed, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: dimOpacity(progress.get()),
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      <Icon width={width} height={height} color={color} />
    </Animated.View>
  );
};

export default HeaderActionIcon;
