import React, { useEffect } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import WebIcon from '../../assets/icons/web.svg';
import CheckIcon from '../../assets/icons/check.svg';
import InfoIcon from '../../assets/icons/info-circle.svg';
import LogoIcon from '../../assets/icons/logo.svg';
import WebFavicon from './WebFavicon';
import { type Row } from './webSearchTrace';
import {
  CONNECTOR_GAP,
  MARKER_SIZE,
  ROW_PADDING_V,
  STEP_DOT_SIZE,
} from './webSearchTraceConstants';

interface Props {
  row: Row;
  isFirst: boolean;
  isLast: boolean;
  onOpen: (url?: string) => void;
  onOpenChallenge: () => void;
}

const ActiveStepMarker = () => {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.set(
      withRepeat(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.55 * pulse.get(),
    transform: [{ scale: 0.85 + 0.2 * pulse.get() }],
  }));
  return (
    <Animated.View style={pulseStyle} testID="web-search-active-marker">
      <LogoIcon width={13} height={15} />
    </Animated.View>
  );
};

const rowContentEqual = (a: Row, b: Row): boolean => {
  const prev = a as Record<string, unknown>;
  const next = b as Record<string, unknown>;
  const keys = Object.keys(prev);
  return (
    keys.length === Object.keys(next).length &&
    keys.every((key) => prev[key] === next[key])
  );
};

const rowsEqual = (prev: Props, next: Props): boolean =>
  prev.isFirst === next.isFirst &&
  prev.isLast === next.isLast &&
  prev.onOpen === next.onOpen &&
  prev.onOpenChallenge === next.onOpenChallenge &&
  rowContentEqual(prev.row, next.row);

const WebSearchTraceRow = ({
  row,
  isFirst,
  isLast,
  onOpen,
  onOpenChallenge,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  const markerVisible =
    row.type === 'step' && !row.done ? STEP_DOT_SIZE : MARKER_SIZE;
  const inset = (MARKER_SIZE - markerVisible) / 2;

  const connectors = (
    <>
      {!isFirst ? (
        <View
          style={[
            styles.connector,
            { top: 0, height: ROW_PADDING_V + inset - CONNECTOR_GAP },
          ]}
        />
      ) : null}
      {!isLast ? (
        <View
          style={[
            styles.connector,
            {
              top: ROW_PADDING_V + MARKER_SIZE - inset + CONNECTOR_GAP,
              bottom: 0,
            },
          ]}
        />
      ) : null}
    </>
  );

  const marker = (): React.ReactNode => {
    switch (row.type) {
      case 'challenge':
        return <View style={styles.stepDot} />;
      case 'note':
        return (
          <InfoIcon
            width={14}
            height={14}
            style={row.tone === 'warn' ? styles.noteWarnIcon : styles.noteIcon}
          />
        );
      case 'step':
        return row.done ? (
          <View style={styles.doneBadge}>
            <CheckIcon width={11} height={11} style={styles.doneCheck} />
          </View>
        ) : row.active ? (
          <ActiveStepMarker />
        ) : (
          <View style={styles.stepDot} />
        );
      case 'page':
        return row.url ? (
          <WebFavicon url={row.url} size={16} />
        ) : (
          <WebIcon
            width={16}
            height={16}
            style={{ color: theme.text.defaultSecondary }}
          />
        );
    }
  };

  const label = (): React.ReactNode => {
    switch (row.type) {
      case 'challenge':
        return (
          <Text style={styles.challengeLabel} numberOfLines={1}>
            Tap to confirm you’re not a robot
          </Text>
        );
      case 'note':
        return (
          <Text
            style={
              row.tone === 'warn' ? styles.noteWarnLabel : styles.noteLabel
            }
            numberOfLines={1}
          >
            {row.label}
          </Text>
        );
      case 'step':
        return (
          <Text style={styles.stepLabel} numberOfLines={1}>
            {row.label}
          </Text>
        );
      case 'page':
        return (
          <Text
            style={[styles.host, row.failed ? styles.hostFailed : null]}
            numberOfLines={1}
          >
            {row.host}
            {row.failed && row.note ? (
              <Text style={styles.pageNote}>{`  ${row.note}`}</Text>
            ) : row.name && row.name !== row.host ? (
              <Text style={styles.pageTitle}>{`  ${row.name}`}</Text>
            ) : null}
          </Text>
        );
    }
  };

  const press = (): React.ComponentProps<typeof Pressable> | null => {
    switch (row.type) {
      case 'challenge':
        return {
          onPress: onOpenChallenge,
          accessibilityRole: 'button',
          accessibilityLabel:
            'The site wants to check you are not a robot — tap to continue',
          testID: 'web-search-challenge',
        };
      case 'page':
        return {
          onPress: () => onOpen(row.url),
          disabled: !row.url,
          accessibilityRole: 'link',
          accessibilityLabel: row.name,
          testID: 'web-search-result',
        };
      default:
        return null;
    }
  };

  const pressProps = press();

  const body = (
    <>
      <View style={styles.marker}>{marker()}</View>
      {label()}
    </>
  );

  return (
    <View style={styles.rowWrap}>
      {connectors}
      {pressProps ? (
        <Pressable style={styles.row} {...pressProps}>
          {body}
        </Pressable>
      ) : (
        <View style={styles.row}>{body}</View>
      )}
    </View>
  );
};

export default React.memo(WebSearchTraceRow, rowsEqual);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    rowWrap: {
      position: 'relative',
    },
    connector: {
      position: 'absolute',
      left: (MARKER_SIZE - 1) / 2,
      width: 1,
      backgroundColor: theme.border.soft,
    },
    marker: {
      width: MARKER_SIZE,
      height: MARKER_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBadge: {
      width: MARKER_SIZE,
      height: MARKER_SIZE,
      borderRadius: MARKER_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border.soft,
    },
    doneCheck: {
      color: theme.text.defaultSecondary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: ROW_PADDING_V,
    },
    stepDot: {
      width: STEP_DOT_SIZE,
      height: STEP_DOT_SIZE,
      borderRadius: STEP_DOT_SIZE / 2,
      backgroundColor: theme.text.defaultTertiary,
    },
    stepLabel: {
      flex: 1,
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
      lineHeight: lineHeights.xs,
    },
    challengeLabel: {
      flex: 1,
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.medium,
      color: theme.bg.main,
      lineHeight: lineHeights.xs,
    },
    host: {
      flex: 1,
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.medium,
      color: theme.text.defaultSecondary,
      lineHeight: lineHeights.xs,
    },
    pageTitle: {
      fontFamily: fontFamily.regular,
      color: theme.text.defaultTertiary,
    },
    hostFailed: {
      color: theme.text.defaultTertiary,
      textDecorationLine: 'line-through',
    },
    pageNote: {
      fontFamily: fontFamily.regular,
      color: theme.text.defaultTertiary,
      textDecorationLine: 'none',
    },
    noteLabel: {
      flex: 1,
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultTertiary,
      lineHeight: lineHeights.xs,
    },
    noteWarnLabel: {
      flex: 1,
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
      lineHeight: lineHeights.xs,
    },
    noteIcon: {
      color: theme.text.defaultTertiary,
    },
    noteWarnIcon: {
      color: theme.text.warning,
    },
  });
