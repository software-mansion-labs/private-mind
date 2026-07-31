import React from 'react';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import ChevronDownIcon from '../../assets/icons/chevron-down.svg';
import { space } from '../../constants/design-system';

interface RowChevronProps {
  expanded: boolean;
  color: string;
}

const RowChevron = ({ expanded, color }: RowChevronProps) => {
  const progress = useDerivedValue(() => withTiming(expanded ? 1 : 0));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <ChevronDownIcon
        width={space.three}
        height={space.three}
        style={{ color }}
      />
    </Animated.View>
  );
};

export default RowChevron;
