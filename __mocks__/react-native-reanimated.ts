// Manual mock that avoids importing the real module (which needs worklets)
const RN = require('react-native');

const createAnimatedComponent = (Component: any) => Component;

interface MockSharedValue<T> {
  value: T;
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
}

const makeSharedValue = <T>(init: T): MockSharedValue<T> => {
  const shared: MockSharedValue<T> = {
    value: init,
    get: () => shared.value,
    set: (next) => {
      shared.value =
        typeof next === 'function'
          ? (next as (prev: T) => T)(shared.value)
          : next;
    },
  };
  return shared;
};

const Animated = {
  View: RN.View,
  Text: RN.Text,
  ScrollView: RN.ScrollView,
  Image: RN.Image,
  FlatList: RN.FlatList,
  createAnimatedComponent,
};

type AnimationBuilder = Record<
  string,
  (...args: unknown[]) => AnimationBuilder
>;

const makeAnimationBuilder = (): AnimationBuilder => {
  const builder = new Proxy(
    {},
    { get: () => () => builder }
  ) as AnimationBuilder;
  return builder;
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,
  createAnimatedComponent,
  useSharedValue: <T>(init: T) => makeSharedValue(init),
  useAnimatedStyle: (fn: () => any) => fn(),
  useAnimatedRef: () => ({ current: null }),
  useDerivedValue: <T>(fn: () => T) => makeSharedValue(fn()),
  useAnimatedScrollHandler: (fn: any) => fn,
  withTiming: (
    val: any,
    _config: any,
    callback?: (finished: boolean) => void
  ) => {
    callback?.(true);
    return val;
  },
  withSpring: (val: any) => val,
  withRepeat: (val: any) => val,
  withDelay: (_d: any, val: any) => val,
  withSequence: (val: any) => val,
  cancelAnimation: () => {},
  Easing: {
    linear: (t: any) => t,
    ease: (t: any) => t,
    quad: (t: any) => t,
    bezier: () => (t: any) => t,
    inOut: (fn: any) => fn,
    out: (fn: any) => fn,
    in: (fn: any) => fn,
    bezier: () => (t: any) => t,
  },
  interpolate: (val: any, inputRange: any, outputRange: any) => {
    if (val <= inputRange[0]) return outputRange[0];
    if (val >= inputRange[inputRange.length - 1])
      return outputRange[outputRange.length - 1];
    return outputRange[0];
  },
  interpolateColor: (val: any, _r: any, outputRange: any) => outputRange[0],
  runOnJS: (fn: any) => fn,
  runOnUI: (fn: any) => fn,
  configureReanimatedLogger: () => {},
  LinearTransition: makeAnimationBuilder(),
  FadeIn: makeAnimationBuilder(),
  FadeInDown: makeAnimationBuilder(),
  FadeOut: makeAnimationBuilder(),
};
