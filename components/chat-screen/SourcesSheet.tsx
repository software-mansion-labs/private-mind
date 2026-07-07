import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
} from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetScrollViewMethods,
} from '@gorhom/bottom-sheet';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { radius, space, textStyles } from '../../constants/design-system';
import SourceIcon from '../../assets/icons/source.svg';
import ChevronDownIcon from '../../assets/icons/chevron-down.svg';
import ChevronUpIcon from '../../assets/icons/chevron-up.svg';
import { type SourceDocument } from '../../database/chatRepository';
import {
  findCitedSpan,
  buildCitationExcerpt,
  queryNamesDocument,
  type CitationExcerpt,
} from '../../utils/citationHighlight';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SOURCE_ROW_HEIGHT = space.twelve;
const SOURCE_ROW_GAP = space.one;
const SHEET_CHROME_HEIGHT = space.ten + space.eight;

const getSourcesSnapPoints = (
  count: number,
  bottomInset: number
): (string | number)[] => {
  const contentHeight =
    SHEET_CHROME_HEIGHT +
    count * SOURCE_ROW_HEIGHT +
    Math.max(0, count - 1) * SOURCE_ROW_GAP +
    bottomInset +
    space.eight;
  const fraction = Math.min(0.9, Math.max(0.32, contentHeight / SCREEN_HEIGHT));
  const first = `${Math.round(fraction * 100)}%`;
  return fraction >= 0.85 ? ['90%'] : [first, '90%'];
};

const SPREADSHEET_DOC_TYPES = new Set(['XLSX', 'XLS', 'XLSM', 'CSV']);

const getDocumentType = (name: string): string => {
  const lastDot = name.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === name.length - 1) return '';
  return name.slice(lastDot + 1).toUpperCase();
};

const renderPassage = (
  excerpt: CitationExcerpt,
  styles: ReturnType<typeof createStyles>
) => {
  const { text, span } = excerpt;

  if (
    !span ||
    span.start < 0 ||
    span.end > text.length ||
    span.start >= span.end
  ) {
    return text;
  }

  return (
    <>
      {text.slice(0, span.start)}
      <Text style={styles.sourcePassageCited}>
        {text.slice(span.start, span.end)}
      </Text>
      {text.slice(span.end)}
    </>
  );
};

export interface SourcesSheetHandle {
  present: (highlightIndex?: number | null) => void;
}

interface SourcesSheetProps {
  sources: SourceDocument[];
  userQuestion?: string;
}

const SourcesSheet = forwardRef<SourcesSheetHandle, SourcesSheetProps>(
  ({ sources, userQuestion }, ref) => {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const sheetRef = useRef<BottomSheetModal>(null);
    const scrollRef = useRef<BottomSheetScrollViewMethods>(null);
    const rowYRef = useRef<Record<number, number>>({});
    const listYRef = useRef(0);
    const [highlightedIndex, setHighlightedIndex] = useState<number | null>(
      null
    );
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        present: (highlightIndex: number | null = null) => {
          setHighlightedIndex(highlightIndex);
          setExpandedIndex(highlightIndex);
          sheetRef.current?.present();
        },
      }),
      []
    );

    const snapPoints = useMemo(
      () => getSourcesSnapPoints(sources.length, theme.insets.bottom),
      [sources.length, theme.insets.bottom]
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      ),
      []
    );

    const toggleExpanded = useCallback(
      (index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const willExpand = expandedIndex !== index;
        setExpandedIndex(willExpand ? index : null);
        if (willExpand) {
          setTimeout(() => {
            const y = listYRef.current + (rowYRef.current[index] ?? 0);
            scrollRef.current?.scrollTo({
              y: Math.max(space.none, y - space.two),
              animated: true,
            });
          }, 260);
        }
      },
      [expandedIndex]
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

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        index={0}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sourcesSheetBackground}
        handleIndicatorStyle={styles.sourcesSheetHandle}
        onDismiss={() => {
          setHighlightedIndex(null);
          setExpandedIndex(null);
        }}
      >
        <BottomSheetScrollView
          ref={scrollRef}
          contentContainerStyle={styles.sourcesSheet}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sourcesSheetTitle}>Sources</Text>
          <View
            style={styles.sourcesList}
            onLayout={(e) => {
              listYRef.current = e.nativeEvent.layout.y;
            }}
          >
            {sources.map((source, index) => {
              const docType = getDocumentType(source.name);
              const isSpreadsheet = SPREADSHEET_DOC_TYPES.has(docType);
              const hasPassage = !!source.passage && !isSpreadsheet;
              const isExpanded = expandedIndex === index;

              return (
                <Pressable
                  key={`${source.documentId ?? 'unknown'}-${source.name}`}
                  style={[
                    styles.sourceRow,
                    highlightedIndex === index && styles.sourceRowHighlighted,
                  ]}
                  onPress={hasPassage ? () => toggleExpanded(index) : undefined}
                  onLayout={(e) => {
                    rowYRef.current[index] = e.nativeEvent.layout.y;
                  }}
                  disabled={!hasPassage}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                  testID="source-item"
                >
                  <View style={styles.sourceRowHeader}>
                    <View style={styles.sourceIconWrapper}>
                      <SourceIcon
                        width={space.four}
                        height={space.four}
                        style={styles.sourceRowIcon}
                      />
                    </View>
                    {docType ? (
                      <Text style={styles.sourceRowType}>{docType}</Text>
                    ) : null}
                    <Text style={styles.sourceRowName} numberOfLines={1}>
                      {source.name}
                    </Text>
                    {hasPassage ? (
                      isExpanded ? (
                        <ChevronUpIcon
                          width={space.three}
                          height={space.three}
                          style={styles.sourceRowChevron}
                        />
                      ) : (
                        <ChevronDownIcon
                          width={space.three}
                          height={space.three}
                          style={styles.sourceRowChevron}
                        />
                      )
                    ) : null}
                  </View>
                  {hasPassage && isExpanded && expandedExcerpt ? (
                    <Text
                      style={styles.sourcePassageText}
                      testID="source-passage"
                    >
                      {renderPassage(expandedExcerpt, styles)}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

SourcesSheet.displayName = 'SourcesSheet';

export default SourcesSheet;

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
      gap: space.one,
    },
    sourceRow: {
      flexDirection: 'column',
      gap: space.two,
      paddingVertical: space.twoHalf,
      paddingHorizontal: space.two,
      borderRadius: radius.twelve,
    },
    sourceRowHighlighted: {
      backgroundColor: theme.bg.softSecondary,
    },
    sourceRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.two,
    },
    sourceIconWrapper: {
      width: space.six + space.one,
      height: space.six + space.one,
      borderRadius: radius.six,
      backgroundColor: theme.bg.softSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sourceRowIcon: {
      color: theme.text.primary,
    },
    sourceRowType: {
      ...textStyles.bodyQuaternaryMedium,
      color: theme.text.defaultTertiary,
    },
    sourceRowName: {
      flex: 1,
      ...textStyles.bodySecondaryMedium,
      color: theme.text.primary,
    },
    sourceRowChevron: {
      color: theme.text.defaultTertiary,
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
