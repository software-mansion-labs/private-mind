import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import WebIcon from '../../assets/icons/web.svg';
import RowChevron from './RowChevron';
import { type SourceDocument } from '../../database/chatRepository';
import { Feedback } from '../../utils/Feedback';
import {
  useWebSearchStore,
  type WebSearchTraceEntry,
} from '../../store/webSearchStore';
import { buildRows } from './webSearchTrace';
import {
  ROW_HEIGHT,
  ROW_INDENT,
  STAGGER_MS,
  WEB_TRACE_TRANSITION_MS,
} from './webSearchTraceConstants';
import WebSearchTraceList from './WebSearchTraceList';
import WebSearchTraceRow from './WebSearchTraceRow';

interface Props {
  isSearching: boolean;
  trace: WebSearchTraceEntry[];
  results: SourceDocument[];
}

const deriveTitle = (
  isSearching: boolean,
  trace: WebSearchTraceEntry[]
): string => {
  if (isSearching) return 'Searching the web…';
  if (trace.some((entry) => entry.type === 'offline'))
    return 'No internet connection';
  if (trace.some((entry) => entry.type === 'skipped'))
    return 'Answered without searching';
  return 'Searched the web';
};

const WebSearchBlock = memo(({ isSearching, trace, results }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  const isLiveBlock = isSearching || trace.length > 0;
  const traceExpanded = useWebSearchStore(
    (state) => isLiveBlock && state.traceExpanded
  );
  const setTraceExpanded = useWebSearchStore((state) => state.setTraceExpanded);
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = isLiveBlock ? traceExpanded : localExpanded;

  useEffect(() => {
    if (isLiveBlock) setLocalExpanded(traceExpanded);
  }, [isLiveBlock, traceExpanded]);

  const challengeActive = useWebSearchStore(
    (state) => isSearching && state.challengeActive
  );
  const openChallenge = useWebSearchStore((state) => state.openChallenge);

  const rows = useMemo(
    () => buildRows(isSearching, trace, results, challengeActive),
    [isSearching, trace, results, challengeActive]
  );

  const seenKeys = useRef<Set<string>>(new Set());
  const enterDelay = useMemo(() => {
    const delays = new Map<string, number>();
    let fresh = 0;
    for (const row of rows) {
      if (seenKeys.current.has(row.key)) {
        delays.set(row.key, 0);
      } else {
        delays.set(row.key, fresh * STAGGER_MS);
        fresh += 1;
      }
    }
    return delays;
  }, [rows]);

  useEffect(() => {
    if (!expanded) {
      seenKeys.current.clear();
      return;
    }
    for (const row of rows) seenKeys.current.add(row.key);
  }, [expanded, rows]);

  const [listMounted, setListMounted] = useState(false);
  useEffect(() => {
    if (expanded) setListMounted(true);
  }, [expanded]);
  const isSearchingRef = useRef(isSearching);
  isSearchingRef.current = isSearching;
  const handleCollapsed = useCallback(() => {
    if (isSearchingRef.current) setListMounted(false);
  }, []);

  const openPage = useCallback((url?: string) => {
    if (!url) return;
    WebBrowser.openBrowserAsync(url).catch((error) =>
      console.warn('Failed to open browser', error)
    );
  }, []);

  if (rows.length === 0 && !isSearching) return null;

  const title = deriveTitle(isSearching, trace);
  const current = rows[rows.length - 1];

  const toggleExpanded = () => {
    Feedback.sheetOpen();
    if (isLiveBlock) setTraceExpanded(!expanded);
    else setLocalExpanded((prev) => !prev);
  };

  return (
    <Animated.View
      style={styles.container}
      layout={
        isSearching
          ? LinearTransition.duration(WEB_TRACE_TRANSITION_MS)
          : undefined
      }
    >
      <Pressable
        style={styles.header}
        onPress={toggleExpanded}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        testID="web-search-block"
      >
        <WebIcon width={15} height={15} style={styles.headerIcon} />
        <Text style={styles.title} numberOfLines={1} testID="web-search-title">
          {title}
        </Text>
        {rows.length > 0 ? (
          <RowChevron expanded={expanded} color={theme.text.defaultSecondary} />
        ) : null}
      </Pressable>

      {listMounted ? (
        <WebSearchTraceList
          expanded={expanded}
          rows={rows}
          enterDelay={enterDelay}
          animateRows={isSearching}
          onOpen={openPage}
          onOpenChallenge={openChallenge}
          onCollapsed={handleCollapsed}
        />
      ) : isSearching && current ? (
        <Animated.View
          style={styles.currentSlot}
          exiting={FadeOut.duration(160)}
        >
          <Animated.View
            key={current.key}
            style={styles.currentRow}
            entering={FadeIn.duration(WEB_TRACE_TRANSITION_MS)}
            exiting={FadeOut.duration(200)}
          >
            <WebSearchTraceRow
              row={current}
              isFirst
              isLast
              onOpen={openPage}
              onOpenChallenge={openChallenge}
            />
          </Animated.View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
});

WebSearchBlock.displayName = 'WebSearchBlock';

export default WebSearchBlock;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      marginTop: 6,
      marginBottom: 6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 2,
    },
    headerIcon: {
      color: theme.text.primary,
    },
    title: {
      flexShrink: 1,
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    currentSlot: {
      marginTop: 6,
      height: ROW_HEIGHT,
    },
    currentRow: {
      position: 'absolute',
      left: ROW_INDENT,
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
  });
