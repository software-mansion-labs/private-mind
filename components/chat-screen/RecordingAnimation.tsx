import React, { useCallback, useImperativeHandle, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface Props {
  ref?: React.Ref<{ pushChunk: (data: number[]) => void }>;
  width: number;
  height: number;
}

const SAMPLE_RATE = 16000;
/**
 * time for a bar to move from start to end of the window, in ms
 * needs to be larger than duration covered by each chunk to avoid gaps
 */
const WINDOW_DURATION = 4000;
const SAMPLES_PER_WINDOW = (WINDOW_DURATION * SAMPLE_RATE) / 1000;

const BAR_WIDTH = 2;
const BAR_GAP = 3;
/** distance between centers of two consecutive bars */
const BAR_OFFSET = BAR_WIDTH + BAR_GAP;

const RecordingAnimation: React.FC<Props> = ({ width, height, ref }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const barsPerWindow = Math.floor(width / BAR_OFFSET);
  const windowWidth = barsPerWindow * BAR_OFFSET;

  const lastDataRef = React.useRef<number[]>([]);
  const offset = useSharedValue(0);
  const barsPath = useSharedValue<string | undefined>('');

  useImperativeHandle(
    ref,
    () => ({
      pushChunk: (data: number[]) => {
        const samplesPerBar = Math.floor(SAMPLES_PER_WINDOW / barsPerWindow);
        const newBars = prepareBars(data, samplesPerBar);
        const newBarsCount = newBars.length;

        const updatedBars = lastDataRef.current
          .slice(-barsPerWindow)
          .concat(newBars);
        lastDataRef.current = updatedBars;

        offset.value = newBarsCount * BAR_OFFSET;
        barsPath.value = prepareBarsPath(updatedBars, {
          barsPerWindow,
          height,
        });

        offset.value = withTiming(0, {
          duration: (newBarsCount / barsPerWindow) * WINDOW_DURATION,
          easing: Easing.linear,
        });
      },
    }),
    [barsPerWindow, height]
  );

  const barsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value - (offset.value % BAR_OFFSET) }],
  }));

  return (
    <View style={[styles.window, { width, height }]}>
      <Animated.View style={[styles.barContainer, barsStyle]}>
        <Svg
          width={2 * width}
          height={height}
          viewBox={`0 0 ${2 * windowWidth} ${height}`}
        >
          <AnimatedPath
            d={barsPath}
            fill="none"
            stroke="white"
            strokeWidth={BAR_WIDTH}
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

export default RecordingAnimation;

function prepareBars(data: number[], groupSize: number): number[] {
  const chunkCount = Math.ceil(data.length / groupSize);
  return Array.from({ length: chunkCount }, (_, i) => {
    const absData = data.slice(i * groupSize, (i + 1) * groupSize).map(Math.abs);
    return Math.max(...absData)
  });
}

function prepareBarsPath(
  data: number[],
  { barsPerWindow, height }: { barsPerWindow: number; height: number }
) {
  const viewboxWidth = 2 * barsPerWindow * BAR_OFFSET;

  return Array.from({ length: 2 * barsPerWindow }, (_, i) => {
    const xOffset = i * BAR_OFFSET + BAR_WIDTH / 2;
    const x = viewboxWidth - xOffset;
    const v = data[data.length - 1 - i] || 0;
    const py = (height * (1 - v)) / 2;
    return `M ${x},${py} L ${x},${height - py}`;
  }).join(' ');
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    window: {
      overflow: 'hidden',
    },
    barContainer: {
      position: 'absolute',
      top: 0,
      right: 0,
    },
  });
