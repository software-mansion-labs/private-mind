import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  StyleSheet,
  Text,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  useBottomSheetSpringConfigs,
  type BottomSheetBackdropProps,
  type BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet';
import { KeyboardEvents } from 'react-native-keyboard-controller';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../constants/design-system';
import {
  EST_ROW_GAP,
  EST_ROW_HEIGHT,
  EST_SHEET_CHROME,
  KEYBOARD_HIDE_PRESENT_FALLBACK_MS,
  MAX_SHEET_HEIGHT_RATIO,
  ROW_EXPAND_SCROLL_DELAY,
  SHEET_HANDLE_HEIGHT,
  SHEET_SPRING_CONFIG,
} from '../../constants/sources-sheet';
import SheetBackdrop from '../bottomSheets/SheetBackdrop';
import SourceRow from './SourceRow';
import { type SourceDocument } from '../../database/chatRepository';
import {
  findCitedSpan,
  buildCitationExcerpt,
  queryNamesDocument,
  type CitationExcerpt,
} from '../../utils/citationHighlight';

export type SheetStyles = ReturnType<typeof createStyles>;

export interface SourcesSheetHandle {
  present: (
    sources: SourceDocument[],
    userQuestion?: string,
    highlightIndex?: number | null
  ) => void;
}

interface SourcesSheetPayload {
  sources: SourceDocument[];
  userQuestion?: string;
}

const SourcesSheet = forwardRef<SourcesSheetHandle>((_props, ref) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const { height: screenHeight } = useWindowDimensions();

  const sheetRef = useRef<BottomSheetModal>(null);
  const isOpenRef = useRef(false);
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
  const rowYRef = useRef<Record<number, number>>({});
  const listYRef = useRef(0);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [payload, setPayload] = useState<SourcesSheetPayload>({
    sources: [],
  });
  const { sources, userQuestion } = payload;

  const clearScrollTimer = useCallback(() => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = null;
  }, []);

  useEffect(() => clearScrollTimer, [clearScrollTimer]);

  const keyboardHideSubRef = useRef<{ remove: () => void } | null>(null);
  const pendingPresentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const clearPendingPresent = useCallback(() => {
    keyboardHideSubRef.current?.remove();
    keyboardHideSubRef.current = null;
    if (pendingPresentTimerRef.current)
      clearTimeout(pendingPresentTimerRef.current);
    pendingPresentTimerRef.current = null;
  }, []);

  useEffect(() => clearPendingPresent, [clearPendingPresent]);

  useImperativeHandle(
    ref,
    () => ({
      present: (
        nextSources: SourceDocument[],
        nextUserQuestion?: string,
        highlightIndex: number | null = null
      ) => {
        if (isOpenRef.current) return;
        isOpenRef.current = true;
        setPayload({ sources: nextSources, userQuestion: nextUserQuestion });
        setHighlightedIndex(highlightIndex);
        setExpandedIndex(highlightIndex);

        if (!Keyboard.isVisible()) {
          sheetRef.current?.present();
          return;
        }

        const presentAfterKeyboardHide = () => {
          clearPendingPresent();
          sheetRef.current?.present();
        };
        keyboardHideSubRef.current = KeyboardEvents.addListener(
          'keyboardDidHide',
          presentAfterKeyboardHide
        );
        pendingPresentTimerRef.current = setTimeout(
          presentAfterKeyboardHide,
          KEYBOARD_HIDE_PRESENT_FALLBACK_MS
        );
        Keyboard.dismiss();
      },
    }),
    [clearPendingPresent]
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => <SheetBackdrop {...props} />,
    []
  );

  const toggleExpanded = useCallback(
    (index: number) => {
      const willExpand = expandedIndex !== index;
      setExpandedIndex(willExpand ? index : null);
      clearScrollTimer();
      if (!willExpand) return;

      scrollTimerRef.current = setTimeout(() => {
        const y = listYRef.current + (rowYRef.current[index] ?? 0);
        scrollRef.current?.scrollTo({
          y: Math.max(space.none, y - space.two),
          animated: true,
        });
      }, ROW_EXPAND_SCROLL_DELAY);
    },
    [expandedIndex, clearScrollTimer]
  );

  const anyNamedSource = useMemo(
    () =>
      sources.some((source) =>
        queryNamesDocument(userQuestion ?? '', source.name)
      ),
    [sources, userQuestion]
  );

  const expandedExcerpt = useMemo<CitationExcerpt | null>(() => {
    if (expandedIndex === null) return null;
    const source = sources[expandedIndex];
    const passage = source?.passage;
    const suppressHighlight =
      anyNamedSource &&
      !queryNamesDocument(userQuestion ?? '', source?.name ?? '');
    const span = suppressHighlight
      ? null
      : findCitedSpan(passage, userQuestion ?? '');
    return buildCitationExcerpt(passage, span);
  }, [expandedIndex, sources, userQuestion, anyNamedSource]);

  const onContentSizeChange = useCallback((width: number, height: number) => {
    const next = Math.round(height);
    setContentHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev));
  }, []);

  const snapPoints = useMemo<number[]>(() => {
    const seed =
      EST_SHEET_CHROME +
      theme.insets.bottom +
      sources.length * EST_ROW_HEIGHT +
      Math.max(0, sources.length - 1) * EST_ROW_GAP;
    const target = contentHeight ? contentHeight + SHEET_HANDLE_HEIGHT : seed;
    return [Math.min(target, screenHeight * MAX_SHEET_HEIGHT_RATIO)];
  }, [contentHeight, sources.length, theme.insets.bottom, screenHeight]);

  const animationConfigs = useBottomSheetSpringConfigs(SHEET_SPRING_CONFIG);

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      animationConfigs={animationConfigs}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sourcesSheetBackground}
      handleIndicatorStyle={styles.sourcesSheetHandle}
      onChange={(index) => {
        isOpenRef.current = index >= 0;
      }}
      onDismiss={() => {
        isOpenRef.current = false;
        clearPendingPresent();
        clearScrollTimer();
        setHighlightedIndex(null);
        setExpandedIndex(null);
      }}
    >
      <BottomSheetScrollView
        ref={scrollRef}
        contentContainerStyle={styles.sourcesSheet}
        onContentSizeChange={onContentSizeChange}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sourcesSheetTitle}>Sources</Text>
        <View
          style={styles.sourcesList}
          onLayout={(e) => {
            listYRef.current = e.nativeEvent.layout.y;
          }}
        >
          {sources.map((source, index) => (
            <SourceRow
              key={
                source.kind === 'web' && source.url
                  ? `web:${source.url}`
                  : `${source.documentId ?? 'unknown'}-${source.name}`
              }
              source={source}
              isHighlighted={highlightedIndex === index}
              isExpanded={expandedIndex === index}
              excerpt={expandedExcerpt}
              chevronColor={theme.text.defaultTertiary}
              styles={styles}
              onToggle={() => toggleExpanded(index)}
              onLayout={(e) => {
                rowYRef.current[index] = e.nativeEvent.layout.y;
              }}
            />
          ))}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

SourcesSheet.displayName = 'SourcesSheet';

export default memo(SourcesSheet);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sourcesSheetBackground: {
      backgroundColor: theme.bg.softPrimary,
    },
    sourcesSheetHandle: {
      backgroundColor: theme.border.soft,
    },
    sourcesSheet: {
      paddingHorizontal: space.four,
      paddingTop: space.two,
      paddingBottom: theme.insets.bottom + space.eight,
      gap: space.three,
      backgroundColor: theme.bg.softPrimary,
    },
    sourcesSheetTitle: {
      ...textStyles.titleH3,
      color: theme.text.primary,
    },
    sourcesList: {
      gap: space.two,
    },
    sourceRow: {
      flexDirection: 'column',
      gap: space.two,
      paddingVertical: space.three,
      paddingHorizontal: space.three,
      borderRadius: radius.twelve,
      borderWidth: stroke.soft,
      borderColor: theme.border.soft,
    },
    sourceRowHighlighted: {
      backgroundColor: theme.bg.softSecondary,
    },
    webRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.two,
      paddingVertical: space.two,
      paddingHorizontal: space.three,
      borderRadius: radius.twelve,
    },
    webRowText: {
      flex: 1,
      gap: 2,
    },
    webRowTitle: {
      ...textStyles.bodySecondaryMedium,
      color: theme.text.primary,
    },
    webRowHost: {
      ...textStyles.bodyTertiaryRegular,
      color: theme.text.defaultTertiary,
    },
    webRowSnippetOnly: {
      ...textStyles.bodyTertiaryRegular,
      color: theme.text.defaultTertiary,
      fontStyle: 'italic',
    },
    sourceRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.two,
    },
    typeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.half,
      paddingVertical: space.one,
      paddingHorizontal: space.two,
      borderWidth: stroke.soft,
      borderColor: theme.border.soft,
      borderRadius: radius.full,
    },
    typeBadgeIcon: {
      color: theme.text.defaultSecondary,
    },
    typeBadgeText: {
      ...textStyles.bodyTertiaryRegular,
      color: theme.text.defaultSecondary,
    },
    sourceRowName: {
      flex: 1,
      ...textStyles.bodySecondaryMedium,
      color: theme.text.primary,
    },
    sourcePassageText: {
      ...textStyles.bodyTertiaryRegular,
      color: theme.text.defaultTertiary,
    },
    sourcePassageCited: {
      ...textStyles.bodyTertiaryMedium,
      color: theme.text.primary,
    },
  });
