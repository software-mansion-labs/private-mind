import React, { memo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MarkdownComponent from './MarkdownComponent';
import ThinkingBlock from './ThinkingBlock';
import LlamaIcon from '../../assets/icons/llama_icon.svg';
import ColorPalette from '../../colors';
import { useLLMStore } from '../../store/llmStore';

interface StreamingMessageItemProps {
  content: string;
}

const StreamingMessageItem = memo(({ content }: StreamingMessageItemProps) => {
  const { model } = useLLMStore();
  // Function to parse streaming content with thinking blocks
  const parseStreamingContent = (text: string) => {
    const thinkStartIndex = text.indexOf('<think>');

    if (thinkStartIndex === -1) {
      // No thinking block, return all as normal content
      return { normalContent: text, thinkingContent: null, hasThinking: false };
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

  const parsedContent = parseStreamingContent(content);

  return (
    <View style={styles.aiMessage}>
      <View style={styles.iconBubble}>
        <LlamaIcon width={24} height={24} />
      </View>
      <View style={styles.bubbleContent}>
        <Text>{model!.id}</Text>
        {parsedContent.normalContent.trim() && (
          <MarkdownComponent text={parsedContent.normalContent} />
        )}
        <View>
          {parsedContent.hasThinking && (
            <ThinkingBlock
              content={parsedContent.thinkingContent || ''}
              isComplete={parsedContent.isThinkingComplete || false}
            />
          )}

          {parsedContent.normalAfterThink &&
            parsedContent.normalAfterThink.trim() && (
              <MarkdownComponent text={parsedContent.normalAfterThink} />
            )}
        </View>
      </View>
    </View>
  );
});

export default StreamingMessageItem;

const styles = StyleSheet.create({
  aiMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    marginHorizontal: 12,
    maxWidth: '85%',
    alignSelf: 'flex-start',
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
});
