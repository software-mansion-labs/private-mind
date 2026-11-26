import React from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { CAPPED_TEXT_MAX_SCALE } from '../constants/font-scale';

const LABEL_MEASURING_ROOM = 400;
const FADE_OUT_BY = 0.6;

interface Props {
  text: string;
  collapse: SharedValue<number>;
  gap: number;
  estimatedWidth: number;
  textStyle: StyleProp<TextStyle>;
}

const CollapsibleLabel = ({
  text,
  collapse,
  gap,
  estimatedWidth,
  textStyle,
}: Props) => {
  const labelWidth = useSharedValue(estimatedWidth);

  const handleLabelLayout = (event: LayoutChangeEvent) =>
    labelWidth.set(event.nativeEvent.layout.width);

  const slotStyle = useAnimatedStyle(() => ({
    width: interpolate(collapse.get(), [0, 1], [labelWidth.get(), 0]),
    marginLeft: interpolate(collapse.get(), [0, 1], [gap, 0]),
    opacity: interpolate(collapse.get(), [0, FADE_OUT_BY], [1, 0], 'clamp'),
  }));

  return (
    <Animated.View style={[styles.slot, slotStyle]}>
      <View style={styles.room}>
        <Text
          style={textStyle}
          numberOfLines={1}
          maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
          onLayout={handleLabelLayout}
        >
          {text}
        </Text>
      </View>
    </Animated.View>
  );
};

export default CollapsibleLabel;

const styles = StyleSheet.create({
  slot: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  room: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: LABEL_MEASURING_ROOM,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
