import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import WebIcon from '../../assets/icons/web.svg';
import CheckIcon from '../../assets/icons/check.svg';
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

const WebSearchTraceRow = ({
  row,
  isFirst,
  isLast,
  onOpen,
  onOpenChallenge,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

  if (row.type === 'challenge') {
    return (
      <View style={styles.rowWrap}>
        {connectors}
        <Pressable
          style={styles.row}
          onPress={onOpenChallenge}
          accessibilityRole="button"
          accessibilityLabel="Verify to continue searching"
          testID="web-search-challenge"
        >
          <View style={styles.marker}>
            <View style={styles.stepDot} />
          </View>
          <Text style={styles.challengeLabel} numberOfLines={1}>
            Verify to continue
          </Text>
        </Pressable>
      </View>
    );
  }

  if (row.type === 'step') {
    return (
      <View style={styles.rowWrap}>
        {connectors}
        <View style={styles.row}>
          <View style={styles.marker}>
            {row.done ? (
              <View style={styles.doneBadge}>
                <CheckIcon width={11} height={11} style={styles.doneCheck} />
              </View>
            ) : (
              <View style={styles.stepDot} />
            )}
          </View>
          <Text style={styles.stepLabel} numberOfLines={1}>
            {row.label}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rowWrap}>
      {connectors}
      <Pressable
        style={styles.row}
        onPress={() => onOpen(row.url)}
        disabled={!row.url}
        accessibilityRole="link"
        accessibilityLabel={row.name}
        testID="web-search-result"
      >
        <View style={styles.marker}>
          {row.url ? (
            <WebFavicon url={row.url} size={16} />
          ) : (
            <WebIcon
              width={16}
              height={16}
              style={{ color: theme.text.defaultSecondary }}
            />
          )}
        </View>
        <Text style={styles.host} numberOfLines={1}>
          {row.host}
        </Text>
      </Pressable>
    </View>
  );
};

export default WebSearchTraceRow;

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
  });
