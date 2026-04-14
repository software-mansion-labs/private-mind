// Manual mock that avoids importing the real module (which needs worklets)
const RN = require('react-native');

const createAnimatedComponent = (Component: any) => Component;

const Animated = {
  View: RN.View,
  Text: RN.Text,
  ScrollView: RN.ScrollView,
  Image: RN.Image,
  FlatList: RN.FlatList,
  createAnimatedComponent,
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  createAnimatedComponent,
  useSharedValue: (init: any) => ({ value: init }),
  useAnimatedStyle: (fn: () => any) => fn(),
  useAnimatedRef: () => ({ current: null }),
  useDerivedValue: (fn: () => any) => ({ value: fn() }),
  useAnimatedScrollHandler: (fn: any) => fn,
  withTiming: (val: any) => val,
  withSpring: (val: any) => val,
  withRepeat: (val: any) => val,
  withDelay: (_d: any, val: any) => val,
  withSequence: (val: any) => val,
  cancelAnimation: () => {},
  Easing: {
    linear: (t: any) => t,
    ease: (t: any) => t,
    quad: (t: any) => t,
    inOut: (fn: any) => fn,
    out: (fn: any) => fn,
    in: (fn: any) => fn,
  },
  interpolate: (val: any, inputRange: any, outputRange: any) => {
    if (val <= inputRange[0]) return outputRange[0];
    if (val >= inputRange[inputRange.length - 1])
      return outputRange[outputRange.length - 1];
    return outputRange[0];
  },
  interpolateColor: (val: any, _r: any, outputRange: any) =>
    outputRange[0],
  runOnJS: (fn: any) => fn,
  runOnUI: (fn: any) => fn,
};
