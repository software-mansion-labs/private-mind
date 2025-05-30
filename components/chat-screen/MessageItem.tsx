import React, { memo, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import MarkdownComponent from './MarkdownComponent';
import LlamaIcon from '../../assets/icons/llama_icon.svg';
import ColorPalette from '../../colors';
import { Message } from '../../database/chatRepository';
import ThinkingBlock from './ThinkingBlock';

interface MessageItemProps {
  message: Message;
}

const MessageItem = memo(({ message }: MessageItemProps) => {
  const isAssistant = message.role === 'assistant';
  const [expandedThinking, setExpandedThinking] = useState<boolean>(false);

  // Function to parse thinking content
  const parseThinkingContent = (content: string) => {
    const thinkingRegex = /<think>([\s\S]*?)<\/think>/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = thinkingRegex.exec(content)) !== null) {
      // Add content before thinking block
      if (match.index > lastIndex) {
        parts.push({
          type: 'normal',
          content: content.slice(lastIndex, match.index),
        });
      }

      // Add thinking content
      parts.push({
        type: 'thinking',
        content: match[1].trim(),
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining content after last thinking block
    if (lastIndex < content.length) {
      parts.push({
        type: 'normal',
        content: content.slice(lastIndex),
      });
    }

    return parts.length > 0 ? parts : [{ type: 'normal', content }];
  };

  const contentParts = parseThinkingContent(message.content);

  const toggleThinking = () => {
    setExpandedThinking((prev) => !prev);
  };

  return (
    <View style={isAssistant ? styles.aiMessage : styles.userMessage}>
      {isAssistant && (
        <View style={styles.iconBubble}>
          <LlamaIcon width={24} height={24} />
        </View>
      )}
      <View style={styles.bubbleContent}>
        {contentParts.map((part, index) => (
          <View key={index}>
            {part.type === 'thinking' ? (
              <ThinkingBlock
                content={part.content}
                isComplete={expandedThinking}
              />
            ) : (
              part.content.trim() && <MarkdownComponent text={part.content} />
            )}
          </View>
        ))}
        {isAssistant && message.tokensPerSecond !== undefined && (
          <Text style={styles.meta}>
            ⏱️ {message.timeToFirstToken?.toFixed()} ms • ⚡{' '}
            {message.tokensPerSecond?.toFixed(2)} tok/s
          </Text>
        )}
      </View>
    </View>
  );
});

export default MessageItem;

const styles = StyleSheet.create({
  aiMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    marginHorizontal: 12,
    maxWidth: '85%',
    alignSelf: 'flex-start',
  },
  userMessage: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: 12,
    marginHorizontal: 12,
    maxWidth: '85%',
    alignSelf: 'flex-end',
    backgroundColor: ColorPalette.seaBlueLight,
    borderRadius: 12,
    padding: 12,
  },
  iconBubble: {
    backgroundColor: ColorPalette.seaBlueLight,
    height: 32,
    width: 32,
    borderRadius: 16,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleContent: {
    flexShrink: 1,
  },
  thinkingBox: {
    backgroundColor: ColorPalette.seaBlueLight,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: ColorPalette.blueDark,
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
  },
  chevronButton: {
    padding: 4,
  },
  chevron: {
    fontSize: 16,
    color: ColorPalette.blueDark,
    fontWeight: 'bold',
  },
  thinkingContent: {
    overflow: 'hidden',
  },
  thinkingContentCollapsed: {
    height: 60,
  },
  meta: {
    fontSize: 12,
    marginTop: 8,
    color: ColorPalette.blueDark,
  },
});
