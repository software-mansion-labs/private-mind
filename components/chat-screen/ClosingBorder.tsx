import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { roundedPerimeter } from './roundedPerimeter';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const outlineFromTopCentre = (
  inset: number,
  width: number,
  height: number,
  r: number
) => {
  const left = inset;
  const top = inset;
  const right = inset + width;
  const bottom = inset + height;
  const centre = inset + width / 2;
  return [
    `M ${centre} ${top}`,
    `H ${right - r}`,
    `A ${r} ${r} 0 0 1 ${right} ${top + r}`,
    `V ${bottom - r}`,
    `A ${r} ${r} 0 0 1 ${right - r} ${bottom}`,
    `H ${left + r}`,
    `A ${r} ${r} 0 0 1 ${left} ${bottom - r}`,
    `V ${top + r}`,
    `A ${r} ${r} 0 0 1 ${left + r} ${top}`,
    'Z',
  ].join(' ');
};

const CLOSE_MS = 350;
const STROKE_WIDTH = 2;
const MEETING_OVERLAP = 1;

interface Props {
  active: boolean;
  radius: number;
  color: string;
}

const ClosingBorder = ({ active, radius, color }: Props) => {
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

  const closed = useSharedValue(0);
  useEffect(() => {
    closed.set(
      active
        ? withTiming(1, {
            duration: CLOSE_MS,
            easing: Easing.out(Easing.cubic),
          })
        : 0
    );
  }, [active, closed]);

  if (perimeter <= 0) {
    return (
      <View
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        onLayout={onLayout}
      />
    );
  }

  const shape = {
    outline: outlineFromTopCentre(inset, width, height, cornerRadius),
    color,
    perimeter,
    closed,
  };

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
    >
      <Svg width={size.width} height={size.height}>
        <ClosingSide {...shape} clockwise />
        <ClosingSide {...shape} clockwise={false} />
      </Svg>
    </View>
  );
};

export default ClosingBorder;

interface ClosingSideProps {
  outline: string;
  color: string;
  perimeter: number;
  closed: SharedValue<number>;
  clockwise: boolean;
}

const ClosingSide = ({
  outline,
  color,
  perimeter,
  closed,
  clockwise,
}: ClosingSideProps) => {
  const animatedProps = useAnimatedProps(() => {
    const length = closed.get() * (perimeter / 2 + MEETING_OVERLAP);
    return {
      strokeDasharray: [length, Math.max(0, perimeter - length)],
      strokeDashoffset: clockwise ? 0 : length,
      strokeOpacity: closed.get() > 0 ? 1 : 0,
    };
  });
  return (
    <AnimatedPath
      d={outline}
      fill="none"
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  );
};
