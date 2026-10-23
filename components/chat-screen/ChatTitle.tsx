import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { space } from '../../constants/design-system';
import { firstLineOf } from '../../utils/chatLabel';
import ChevronDownIcon from '../../assets/icons/chevron-down.svg';
import GlassSurface from '../GlassSurface';
import { GLASS_BUTTON_SIZE } from '../../constants/header-actions';

const CHEVRON_WIDTH = 10;
const CHEVRON_HEIGHT = 6;
const CHEVRON_SPACE = CHEVRON_WIDTH + space.one + space.four * 2;
const PRESSED_OPACITY = 0.6;

interface Props {
  title: string;
  open?: boolean;
  onPress?: () => void;
  onBottomMeasured?: (bottomY: number) => void;
  maxWidth?: number;
}

const ChatTitle = ({
  title,
  open = false,
  onPress,
  onBottomMeasured,
  maxWidth,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const containerRef = useRef<View>(null);
  const handleLayout = useCallback(() => {
    containerRef.current?.measureInWindow((_x, y, _width, height) => {
      onBottomMeasured?.(Math.round(y + height));
    });
  }, [onBottomMeasured]);

  const [fittedTitle, setFittedTitle] = useState<string | null>(null);
  useEffect(() => setFittedTitle(null), [title, maxWidth]);
  const handleTitleWrap = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) => {
      setFittedTitle(firstLineOf(event.nativeEvent.lines, title));
    },
    [title]
  );
  const shownTitle =
    fittedTitle === null || fittedTitle === title
      ? title
      : `${fittedTitle}\u2026`;

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  useEffect(() => {
    if (!onBottomMeasured) return;
    const frame = requestAnimationFrame(handleLayout);
    return () => cancelAnimationFrame(frame);
  }, [handleLayout, onBottomMeasured, windowWidth, windowHeight]);

  const titleWidth = maxWidth ? maxWidth - CHEVRON_SPACE : undefined;

  return (
    <GlassSurface interactive style={styles.capsule}>
      <Pressable
        ref={containerRef}
        onLayout={onBottomMeasured ? handleLayout : undefined}
        onPress={onPress}
        disabled={!onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          onPress ? `${shownTitle}. Chat options` : shownTitle
        }
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [
          styles.title,
          pressed && onPress && styles.pressed,
        ]}
      >
        {titleWidth ? (
          <View
            style={styles.measure}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text
              style={[styles.titleText, { width: titleWidth }]}
              onTextLayout={handleTitleWrap}
            >
              {title}
            </Text>
          </View>
        ) : null}
        <Text numberOfLines={1} style={styles.titleText}>
          {shownTitle}
        </Text>
        {onPress ? (
          <ChevronDownIcon
            width={CHEVRON_WIDTH}
            height={CHEVRON_HEIGHT}
            style={[styles.chevron, open && styles.chevronOpen]}
          />
        ) : null}
      </Pressable>
    </GlassSurface>
  );
};

export default ChatTitle;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    capsule: {
      height: GLASS_BUTTON_SIZE,
      borderRadius: GLASS_BUTTON_SIZE / 2,
    },
    title: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.one,
      height: GLASS_BUTTON_SIZE,
      paddingHorizontal: space.four,
    },
    pressed: {
      opacity: PRESSED_OPACITY,
    },
    titleText: {
      flexShrink: 1,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    measure: {
      position: 'absolute',
      opacity: 0,
      top: 0,
    },
    chevron: {
      color: theme.text.primary,
    },
    chevronOpen: {
      transform: [{ rotate: '180deg' }],
    },
  });
