import React, { memo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MarkdownComponent from './MarkdownComponent';
import ThinkingBlock from './ThinkingBlock';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';

interface MessageItemProps {
  content: string;
  role: 'user' | 'assistant' | 'system';
  modelName?: string;
  tokensPerSecond?: number;
  timeToFirstToken?: number;
}

const MessageItem = memo(
  ({
    content,
    modelName,
    role,
    tokensPerSecond,
    timeToFirstToken,
  }: MessageItemProps) => {
    const isAssistant = role === 'assistant';
    const { theme } = useTheme();

    const parseThinkingContent = (text: string) => {
      const thinkStartIndex = text.indexOf('<think>');

      if (thinkStartIndex === -1) {
        // No thinking block, return all as normal content
        return {
          normalContent: text,
          thinkingContent: null,
          hasThinking: false,
        };
      }

      const thinkEndIndex = text.indexOf('</think>');
      const normalBeforeThink = text.slice(0, thinkStartIndex);

      if (thinkEndIndex === -1) {
        // Incomplete thinking block (still streaming)
        const thinkingContent = text.slice(thinkStartIndex + 7); // +7 for '<think>'
        return {
          normalContent: normalBeforeThink,
          thinkingContent,
          hasThinking: true,
          isThinkingComplete: false,
          normalAfterThink: '',
        };
      } else {
        // Complete thinking block
        const thinkingContent = text.slice(thinkStartIndex + 7, thinkEndIndex);
        const normalAfterThink = text.slice(thinkEndIndex + 8); // +8 for '</think>'
        return {
          normalContent: normalBeforeThink,
          thinkingContent,
          hasThinking: true,
          isThinkingComplete: true,
          normalAfterThink,
        };
      }
    };

    const contentParts = parseThinkingContent(content);

    return (
      <View
        style={
          isAssistant
            ? styles.aiMessage
            : { ...styles.userMessage, backgroundColor: theme.bg.softSecondary }
        }
      >
        <View style={styles.bubbleContent}>
          {isAssistant && (
            <Text
              style={{
                ...styles.modelName,
                color: theme.text.defaultSecondary,
              }}
            >
              {modelName}
            </Text>
          )}
          {contentParts.normalContent.trim() && (
            <MarkdownComponent text={contentParts.normalContent} />
          )}
          {contentParts.hasThinking && (
            <ThinkingBlock
              content={contentParts.thinkingContent || ''}
              isComplete={true}
            />
          )}
          {contentParts.normalAfterThink &&
            contentParts.normalAfterThink.trim() && (
              <View>
                <MarkdownComponent text={contentParts.normalAfterThink} />
              </View>
            )}
          {isAssistant &&
            tokensPerSecond !== undefined &&
            tokensPerSecond !== 0 && (
              <Text
                style={{
                  ...styles.meta,
                  color: theme.text.defaultTertiary,
                }}
              >
                ttft: {timeToFirstToken?.toFixed()} ms, tps:{' '}
                {tokensPerSecond?.toFixed(2)} tok/s
              </Text>
            )}
        </View>
      </View>
    );
  }
);

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
    alignItems: 'center',
    marginBottom: 12,
    marginHorizontal: 12,
    maxWidth: '65%',
    alignSelf: 'flex-end',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  bubbleContent: {
    width: '100%',
    gap: 4,
  },
  thinkingBox: {
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  modelName: {
    fontSize: fontSizes.fontSizeXs,
    fontFamily: fontFamily.medium,
  },
  meta: {
    fontSize: fontSizes.fontSizeXxs,
    fontFamily: fontFamily.regular,
  },
});
