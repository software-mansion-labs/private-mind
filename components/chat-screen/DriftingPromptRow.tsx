import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDecay,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { radius, space } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import type { PromptSuggestion } from '../../constants/default-prompts';
import { pressedOpacity } from '../../styles/pressable';
import { GUTTER } from './attachments/constants';
import { Glass } from '../Glass';
import {
  DRIFT_RESUME_MS,
  DRIFT_SETTLE_MS,
  ROW_DRAG_SLOP,
  driftStep,
  rowCopyCount,
  rowPositionFor,
  wrapRowOffset,
  type DriftDirection,
} from './promptRowMotion';

const PILL_HEIGHT = 44;
const COPY_ON_SCREEN_AT_REST = 1;
const ICON_TILE_SIZE = 24;
const ICON_SIZE = 14;
const PILL_SHADOW_ROOM = space.two;

interface Props {
  suggestions: PromptSuggestion[];
  direction: DriftDirection;
  running: boolean;
  onSelectPrompt: (prompt: string) => void;
}

const DriftingPromptRow = ({
  suggestions,
  direction,
  running,
  onSelectPrompt,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const { width: viewportWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [measuredCycle, setMeasuredCycle] = useState(0);

  const { offset, cycleWidth } = rowPositionFor(direction, GUTTER);
  const driftShare = useSharedValue(0);
  const gliding = useSharedValue(false);

  const { setActive } = useFrameCallback(({ timeSincePreviousFrame }) => {
    if (gliding.get() || !timeSincePreviousFrame) return;
    offset.set(
      offset.get() +
        driftStep(direction, driftShare.get(), timeSincePreviousFrame)
    );
  }, false);

  useEffect(() => {
    const drifting = running && !reducedMotion;
    setActive(drifting);
    cancelAnimation(driftShare);
    driftShare.set(
      drifting
        ? withDelay(
            DRIFT_SETTLE_MS,
            withTiming(1, { duration: DRIFT_RESUME_MS })
          )
        : 0
    );
  }, [driftShare, reducedMotion, running, setActive]);

  const handleCycleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout;
      cycleWidth.set(width);
      setMeasuredCycle(width);
    },
    [cycleWidth]
  );

  const dragGesture = useMemo(() => {
    const resumeDrift = () => {
      'worklet';
      gliding.set(false);
      driftShare.set(withTiming(1, { duration: DRIFT_RESUME_MS }));
    };

    return Gesture.Pan()
      .activeOffsetX([-ROW_DRAG_SLOP, ROW_DRAG_SLOP])
      .failOffsetY([-ROW_DRAG_SLOP, ROW_DRAG_SLOP])
      .onBegin(() => {
        cancelAnimation(offset);
        cancelAnimation(driftShare);
        gliding.set(false);
        driftShare.set(0);
      })
      .onChange((event) => {
        offset.set(offset.get() + event.changeX);
      })
      .onEnd((event, success) => {
        if (!success) return;
        gliding.set(true);
        offset.set(
          withDecay({ velocity: event.velocityX }, (finished) => {
            if (finished) resumeDrift();
          })
        );
      })
      .onFinalize((_event, success) => {
        if (!success) resumeDrift();
      });
  }, [driftShare, gliding, offset]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: wrapRowOffset(offset.get(), cycleWidth.get()) }],
  }));

  const copies = Array.from(
    { length: rowCopyCount(viewportWidth, measuredCycle) },
    (_, copy) => copy
  );

  return (
    <GestureDetector gesture={dragGesture}>
      <View style={styles.viewport} collapsable={false}>
        <Animated.View style={[styles.track, trackStyle]}>
          {copies.map((copy) => (
            <View
              key={copy}
              style={styles.copy}
              onLayout={copy === 0 ? handleCycleLayout : undefined}
              accessibilityElementsHidden={copy !== COPY_ON_SCREEN_AT_REST}
              importantForAccessibility={
                copy === COPY_ON_SCREEN_AT_REST ? 'auto' : 'no-hide-descendants'
              }
            >
              {suggestions.map((suggestion) => (
                <SuggestionPill
                  key={suggestion.id}
                  suggestion={suggestion}
                  onPress={() => onSelectPrompt(suggestion.prompt)}
                />
              ))}
            </View>
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
};

interface PillProps {
  suggestion: PromptSuggestion;
  onPress: () => void;
}

const SuggestionPill = ({ suggestion, onPress }: PillProps) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const { icon: Icon, tone } = suggestion;
  const toneColors = theme.label[tone];

  return (
    <Glass radius={PILL_HEIGHT / 2} fallbackTint={theme.bg.chatBar}>
      <Pressable
        style={({ pressed }) => [styles.pill, pressed && pressedOpacity]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${suggestion.title}: ${suggestion.prompt}`}
        testID="prompt-suggestion-pill"
      >
        <View
          style={[styles.iconTile, { backgroundColor: toneColors.background }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="prompt-suggestion-tile"
        >
          <Icon
            width={ICON_SIZE}
            height={ICON_SIZE}
            style={{ color: toneColors.foreground }}
          />
        </View>
        <Text
          style={styles.title}
          numberOfLines={1}
          maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
        >
          {suggestion.title}
        </Text>
      </Pressable>
    </Glass>
  );
};

export default DriftingPromptRow;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    viewport: {
      overflow: 'hidden',
      marginHorizontal: -GUTTER,
      paddingVertical: PILL_SHADOW_ROOM,
      marginVertical: -PILL_SHADOW_ROOM,
    },
    track: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
    },
    copy: {
      flexDirection: 'row',
      gap: space.two,
      paddingRight: space.two,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: PILL_HEIGHT,
      gap: space.two,
      paddingLeft: space.twoHalf,
      paddingRight: space.four,
    },
    iconTile: {
      width: ICON_TILE_SIZE,
      height: ICON_TILE_SIZE,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
  });
