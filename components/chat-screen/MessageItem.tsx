import React, { memo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MarkdownComponent from './MarkdownComponent';
import ColorPalette from '../../colors';
import { Message } from '../../database/chatRepository';
import ThinkingBlock from './ThinkingBlock';
import { fontFamily } from '../../fontFamily';

interface MessageItemProps {
  message: Message;
}

const MessageItem = memo(({ message }: MessageItemProps) => {
  const isAssistant = message.role === 'assistant';
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

  return (
    <View style={isAssistant ? styles.aiMessage : styles.userMessage}>
      <View style={styles.bubbleContent}>
        {isAssistant && (
          <Text style={styles.modelName}>{message.modelName}</Text>
        )}
        {contentParts.map((part, index) => (
          <View key={index}>
            {part.type === 'thinking' && part.content !== '' ? (
              <ThinkingBlock content={part.content} isComplete={true} />
            ) : (
              part.content.trim() && (
                <MarkdownComponent text={part.content} isUser={!isAssistant} />
              )
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
    width: '90%',
    alignSelf: 'flex-start',
    lineHeight: 16,
  },
  userMessage: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: 12,
    marginHorizontal: 12,
    maxWidth: '75%',
    alignSelf: 'flex-end',
    backgroundColor: ColorPalette.seaBlueLight,
    borderRadius: 4,
    padding: 12,
  },
  bubbleContent: {
    flexShrink: 1,
    width: '100%',
  },
  thinkingBox: {
    backgroundColor: ColorPalette.seaBlueLight,
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: ColorPalette.blueDark,
  },
  modelName: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: ColorPalette.blueDark,
  },
  meta: {
    fontSize: 12,
    marginTop: 8,
    color: ColorPalette.blueDark,
  },
});
