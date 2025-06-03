import React, { memo, useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ScrollView as ScrollViewType,
} from 'react-native';
import MarkdownComponent from './MarkdownComponent';
import ColorPalette from '../../colors';
import { fontFamily } from '../../fontFamily';

interface ThinkingBlockProps {
  content: string;
  isComplete?: boolean;
}

const ThinkingBlock = memo(
  ({ content, isComplete = true }: ThinkingBlockProps) => {
    const [expanded, setExpanded] = useState(false);
    const scrollViewRef = useRef<ScrollViewType | null>(null);
    const prevContentRef = useRef(content);

    useEffect(() => {
      const hasNewContent = content.length > prevContentRef.current.length;
      const shouldScroll = hasNewContent || !expanded;

      if (shouldScroll) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }

      prevContentRef.current = content;
    }, [content]);

    const toggleExpanded = () => {
      if (!isComplete) return;

      setExpanded((prev) => !prev);
    };

    return (
      <View style={styles.thinkingBox}>
        <View style={styles.thinkingHeader}>
          <Text style={styles.thinkingTitle}>Thinking...</Text>
          <TouchableOpacity
            onPress={toggleExpanded}
            style={styles.chevronButton}
          >
            <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
          </TouchableOpacity>
        </View>

        {expanded ? (
          <MarkdownComponent text={content} />
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.collapsedContent}
            scrollEnabled={false}
            onContentSizeChange={() => {
              scrollViewRef.current?.scrollToEnd({ animated: false });
            }}
          >
            <MarkdownComponent text={content} />
          </ScrollView>
        )}
      </View>
    );
  }
);

export default ThinkingBlock;

const styles = StyleSheet.create({
  thinkingBox: {
    borderRadius: 4,
    marginBottom: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: ColorPalette.blueDark,
    padding: 16,
  },
  thinkingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  thinkingTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: ColorPalette.blueDark,
    fontFamily: fontFamily.bold,
  },
  chevronButton: {
    padding: 4,
  },
  chevron: {
    fontSize: 16,
    color: ColorPalette.blueDark,
    fontWeight: 'bold',
  },
  collapsedContent: {
    height: 60,
  },
  streamingCursor: {
    fontSize: 16,
    color: ColorPalette.blueDark,
    marginTop: 4,
  },
});
