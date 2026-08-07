import React from 'react';
import { View, Text, Pressable, type LayoutChangeEvent } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { space } from '../../constants/design-system';
import RowChevron from './RowChevron';
import SourceIcon from '../../assets/icons/source.svg';
import WebFavicon from './WebFavicon';
import { type SourceDocument } from '../../database/chatRepository';
import { hostname } from '../../utils/web/webResultsToContext';
import { getDocumentType, isSpreadsheetType } from '../../utils/documentType';
import { type CitationExcerpt } from '../../utils/citationHighlight';
import { type SheetStyles } from './SourcesSheet';

const renderPassage = (excerpt: CitationExcerpt, styles: SheetStyles) => {
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

interface SourceRowProps {
  source: SourceDocument;
  isHighlighted: boolean;
  isExpanded: boolean;
  excerpt: CitationExcerpt | null;
  chevronColor: string;
  styles: SheetStyles;
  onToggle: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}

const SourceRow = ({
  source,
  isHighlighted,
  isExpanded,
  excerpt,
  chevronColor,
  styles,
  onToggle,
  onLayout,
}: SourceRowProps) => {
  const isWeb = source.kind === 'web' && !!source.url;
  const docType = isWeb ? hostname(source.url!) : getDocumentType(source.name);
  const hasPassage = !isWeb && !!source.passage && !isSpreadsheetType(docType);

  if (isWeb) {
    return (
      <Pressable
        style={[styles.webRow, isHighlighted && styles.sourceRowHighlighted]}
        onPress={() => {
          WebBrowser.openBrowserAsync(source.url!).catch((error) =>
            console.warn('Failed to open browser', error)
          );
        }}
        onLayout={onLayout}
        accessibilityRole="link"
        accessibilityLabel={source.name}
        testID="source-item"
      >
        <WebFavicon url={source.url!} size={space.four} />
        <View style={styles.webRowText}>
          <Text style={styles.webRowTitle} numberOfLines={2}>
            {source.name}
          </Text>
          <Text style={styles.webRowHost} numberOfLines={1}>
            {hostname(source.url!)}
            {source.read === false ? (
              <Text style={styles.webRowSnippetOnly}>
                {' '}
                · from the search listing only
              </Text>
            ) : null}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.sourceRow, isHighlighted && styles.sourceRowHighlighted]}
      onPress={hasPassage ? onToggle : undefined}
      onLayout={onLayout}
      disabled={!hasPassage}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
      testID="source-item"
    >
      <View style={styles.sourceRowHeader}>
        <View style={styles.typeBadge}>
          <SourceIcon
            width={space.three}
            height={space.three}
            style={styles.typeBadgeIcon}
          />
          {docType ? (
            <Text style={styles.typeBadgeText} numberOfLines={1}>
              {docType}
            </Text>
          ) : null}
        </View>
        <Text style={styles.sourceRowName} numberOfLines={1}>
          {source.name}
        </Text>
        {hasPassage ? (
          <RowChevron expanded={isExpanded} color={chevronColor} />
        ) : null}
      </View>
      {hasPassage && isExpanded && excerpt ? (
        <Text style={styles.sourcePassageText} testID="source-passage">
          {renderPassage(excerpt, styles)}
        </Text>
      ) : null}
    </Pressable>
  );
};

export default SourceRow;
