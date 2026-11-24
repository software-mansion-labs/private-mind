import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { roundedPerimeter } from './roundedPerimeter';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const LAP_MS = 1600;
const FADE_IN_MS = 250;
const FADE_OUT_MS = 200;
const STROKE_WIDTH = 2;
const HEAD_LENGTH = 22;

interface Props {
  active: boolean;
  radius: number;
  colors: readonly [head: string, middle: string, tail: string];
}

const LoadingBorder = ({ active, radius, colors }: Props) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const inset = STROKE_WIDTH / 2;
  const width = Math.max(0, size.width - STROKE_WIDTH);
  const height = Math.max(0, size.height - STROKE_WIDTH);
  const cornerRadius = Math.max(0, radius - inset);
  const perimeter = roundedPerimeter(width, height, cornerRadius);

  const lap = useSharedValue(0);
  const visible = useSharedValue(0);

  useEffect(() => {
    lap.set(0);
    lap.set(
      withRepeat(withTiming(1, { duration: LAP_MS, easing: Easing.linear }), -1)
    );
    return () => cancelAnimation(lap);
  }, [lap]);

  useEffect(() => {
    visible.set(
      withTiming(active ? 1 : 0, {
        duration: active ? FADE_IN_MS : FADE_OUT_MS,
      })
    );
  }, [active, visible]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: visible.get() }));

  const layers = [
    { length: HEAD_LENGTH * 3, color: colors[2], opacity: 0.35 },
    { length: HEAD_LENGTH * 2, color: colors[1], opacity: 0.6 },
    { length: HEAD_LENGTH, color: colors[0], opacity: 1 },
  ];

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
    >
      {perimeter > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
          <Svg width={size.width} height={size.height}>
            {layers.map(({ length, color, opacity }) => (
              <CometLayer
                key={length}
                lap={lap}
                perimeter={perimeter}
                length={length}
                color={color}
                opacity={opacity}
                inset={inset}
                width={width}
                height={height}
                cornerRadius={cornerRadius}
              />
            ))}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
};

export default LoadingBorder;

interface CometLayerProps {
  lap: SharedValue<number>;
  perimeter: number;
  length: number;
  color: string;
  opacity: number;
  inset: number;
  width: number;
  height: number;
  cornerRadius: number;
}

const CometLayer = ({
  lap,
  perimeter,
  length,
  color,
  opacity,
  inset,
  width,
  height,
  cornerRadius,
}: CometLayerProps) => {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: length - lap.get() * perimeter,
  }));
  return (
    <AnimatedRect
      x={inset}
      y={inset}
      width={width}
      height={height}
      rx={cornerRadius}
      ry={cornerRadius}
      fill="none"
      stroke={color}
      strokeOpacity={opacity}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeDasharray={[length, Math.max(0, perimeter - length)]}
      animatedProps={animatedProps}
    />
  );
};
