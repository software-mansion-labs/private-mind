import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import { space } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { firstLineOf } from '../../utils/chatLabel';
import ChevronDownIcon from '../../assets/icons/chevron-down.svg';
import LockIcon from '../../assets/icons/lock-solid.svg';
import { Glass } from '../Glass';
import {
  GLASS_BUTTON_SIZE,
  TITLE_CAPSULE_PADDING,
  TITLE_ICON_HEIGHT,
  TITLE_ICON_WIDTH,
  TITLE_LOCK_GAP,
} from '../../constants/header-actions';

const CHEVRON_GAP = space.one;
const ICONS_SPACE = TITLE_ICON_WIDTH * 2 + CHEVRON_GAP + TITLE_LOCK_GAP;
const ON_DEVICE_LABEL = 'Private, runs on this device';
const ELLIPSIS = '\u2026';

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

  const [fitsWhole, setFitsWhole] = useState<boolean | null>(null);
  const [cutTitle, setCutTitle] = useState<string | null>(null);
  const [ellipsisWidth, setEllipsisWidth] = useState<number | null>(null);
  useEffect(() => {
    setFitsWhole(null);
    setCutTitle(null);
  }, [title, maxWidth]);
  const handleWholeWrap = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) =>
      setFitsWhole(event.nativeEvent.lines.length <= 1),
    []
  );
  const handleCutWrap = useCallback(
    (event: NativeSyntheticEvent<TextLayoutEventData>) =>
      setCutTitle(firstLineOf(event.nativeEvent.lines, title)),
    [title]
  );
  const handleEllipsisLayout = useCallback(
    (event: LayoutChangeEvent) =>
      setEllipsisWidth(Math.ceil(event.nativeEvent.layout.width)),
    []
  );
  const shownTitle =
    fitsWhole !== false || cutTitle === null || cutTitle === title
      ? title
      : `${cutTitle}${ELLIPSIS}`;

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  useEffect(() => {
    if (!onBottomMeasured) return;
    const frame = requestAnimationFrame(handleLayout);
    return () => cancelAnimationFrame(frame);
  }, [handleLayout, onBottomMeasured, windowWidth, windowHeight]);

  const titleWidth = maxWidth
    ? maxWidth - ICONS_SPACE - TITLE_CAPSULE_PADDING * 2
    : undefined;

  return (
    <Glass radius={GLASS_BUTTON_SIZE / 2} style={styles.capsule}>
      <Pressable
        ref={containerRef}
        onLayout={onBottomMeasured ? handleLayout : undefined}
        onPress={onPress}
        disabled={!onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          onPress
            ? `${shownTitle}. ${ON_DEVICE_LABEL}. Chat options`
            : `${shownTitle}. ${ON_DEVICE_LABEL}`
        }
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [
          styles.title,
          pressed && onPress && pressedOpacity,
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
              style={[styles.titleText, styles.ellipsis]}
              onLayout={handleEllipsisLayout}
              maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
              testID="chat-title-ellipsis"
            >
              {ELLIPSIS}
            </Text>
            <Text
              style={[styles.titleText, { width: titleWidth }]}
              onTextLayout={handleWholeWrap}
              maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
              testID="chat-title-whole"
            >
              {title}
            </Text>
            {ellipsisWidth !== null ? (
              <Text
                style={[
                  styles.titleText,
                  { width: titleWidth - ellipsisWidth },
                ]}
                onTextLayout={handleCutWrap}
                maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
                testID="chat-title-cut"
              >
                {title}
              </Text>
            ) : null}
          </View>
        ) : null}
        <LockIcon
          width={TITLE_ICON_WIDTH}
          height={TITLE_ICON_HEIGHT}
          style={styles.lock}
          testID="chat-title-lock"
        />
        <Text
          numberOfLines={1}
          style={styles.titleText}
          maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
        >
          {shownTitle}
        </Text>
        {onPress ? (
          <ChevronDownIcon
            width={TITLE_ICON_WIDTH}
            height={TITLE_ICON_HEIGHT}
            style={[styles.chevron, open && styles.chevronOpen]}
          />
        ) : null}
      </Pressable>
    </Glass>
  );
};

export default ChatTitle;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    capsule: {
      height: GLASS_BUTTON_SIZE,
    },
    title: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: CHEVRON_GAP,
      height: GLASS_BUTTON_SIZE,
      paddingHorizontal: TITLE_CAPSULE_PADDING,
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
    ellipsis: {
      alignSelf: 'flex-start',
    },
    lock: {
      color: theme.text.accent,
      marginRight: TITLE_LOCK_GAP - CHEVRON_GAP,
    },
    chevron: {
      color: theme.text.primary,
    },
    chevronOpen: {
      transform: [{ rotate: '180deg' }],
    },
  });
