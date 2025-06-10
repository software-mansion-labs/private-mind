import React, { memo, useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import MarkdownComponent from './MarkdownComponent';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import ChevronDown from '../../assets/icons/chevron-down.svg';
import ChevronUp from '../../assets/icons/chevron-up.svg';
import { ScrollView } from 'react-native-gesture-handler';

interface Props {
  content: string;
  isComplete?: boolean;
}

const ThinkingBlock = memo(({ content, isComplete = true }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const prevContentRef = useRef(content);
  const { theme } = useTheme();

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
    <View style={{ ...styles.thinkingBox, borderColor: theme.border.soft }}>
      <View style={styles.thinkingHeader}>
        <Text style={{ ...styles.thinkingTitle, color: theme.text.primary }}>
          Thinking...
        </Text>
        <TouchableOpacity onPress={toggleExpanded} style={styles.chevronButton}>
          {expanded ? (
            <ChevronUp width={15} height={8.33} />
          ) : (
            <ChevronDown width={15} height={8.33} />
          )}
        </TouchableOpacity>
      </View>

      {expanded ? (
        <MarkdownComponent text={content} isThinking={true} />
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.collapsedContent}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            scrollViewRef.current?.scrollToEnd({ animated: false });
          }}
        >
          <MarkdownComponent text={content} isThinking={true} />
        </ScrollView>
      )}
    </View>
  );
});

('/');

export default ThinkingBlock;

const styles = StyleSheet.create({
  thinkingBox: {
    borderRadius: 4,
    marginBottom: 8,
    marginTop: 8,
    borderWidth: 1,
    padding: 16,
  },
  thinkingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  thinkingTitle: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.medium,
  },
  chevronButton: {
    padding: 4,
  },
  chevron: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  collapsedContent: {
    height: 80,
  },
});
