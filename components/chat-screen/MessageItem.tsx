import React, { memo, useMemo, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import MarkdownComponent from './MarkdownComponent';
import ThinkingBlock from './ThinkingBlock';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { useLLMStore } from '../../store/llmStore';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import MessageManagementSheet from '../bottomSheets/MessageManagementSheet';
import { Theme } from '../../styles/colors';
import { useMessageListContext } from '../../context/MessageListContext';
import AnimatedChatLoading from './AnimatedChatLoading';

interface MessageItemProps {
  id: number;
  content: string;
  role: 'user' | 'assistant' | 'system' | 'event';
  modelName?: string;
  tokensPerSecond?: number;
  timeToFirstToken?: number;
  isLastMessage: boolean;
  isLastUserMessage?: boolean;
  isLastAssistantMessage?: boolean;
}

const MessageItem = ({
  content,
  modelName,
  role,
  tokensPerSecond,
  timeToFirstToken,
  isLastMessage = false,
  isLastUserMessage = false,
  isLastAssistantMessage = false,
}: MessageItemProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { isGenerating } = useLLMStore();
  const messageManagementSheetRef = useRef<BottomSheetModal | null>(null);
  const { isProcessingPrompt } = useLLMStore();

  // Get context to track user message height
  const { assistantMessageHeight, lastUserMessageHeight } =
    useMessageListContext();

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
    <>
      {role === 'event' ? (
        <View style={styles.eventMessage}>
          <Text style={styles.eventMessageFileName}>
            {content.split(' ')[0]}{' '}
            <Text style={styles.eventMessageText}>
              {content.slice(content.indexOf(' ') + 1)}
            </Text>
          </Text>
        </View>
      ) : (
        <>
          <Animated.View
            onLayout={(event) => {
              const messageHeight = event.nativeEvent.layout.height;
              if (isLastAssistantMessage) {
                assistantMessageHeight.value = messageHeight;
              } else if (isLastUserMessage) {
                lastUserMessageHeight.value = messageHeight;
              }
            }}
            style={role === 'assistant' ? styles.aiMessage : styles.userMessage}
          >
            {isProcessingPrompt && isLastMessage && role === 'assistant' ? (
              <View style={styles.bubbleContent}>
                <Text style={styles.modelName}>{modelName}</Text>
                <AnimatedChatLoading />
              </View>
            ) : (
              <View style={styles.bubbleContent}>
                {role === 'assistant' && (
                  <Text style={styles.modelName}>{modelName}</Text>
                )}
                {contentParts.normalContent.trim() && (
                  <TouchableOpacity
                    onLongPress={() => {
                      messageManagementSheetRef.current?.present(content);
                    }}
                    delayPressIn={50}
                    activeOpacity={0.4}
                  >
                    <MarkdownComponent text={contentParts.normalContent} />
                  </TouchableOpacity>
                )}
                {contentParts.hasThinking &&
                  contentParts.thinkingContent?.trim() && (
                    <ThinkingBlock
                      content={contentParts.thinkingContent || ''}
                      isComplete={contentParts.isThinkingComplete}
                      inProgress={
                        isLastMessage &&
                        isGenerating &&
                        !contentParts.isThinkingComplete
                      }
                    />
                  )}
                {contentParts.normalAfterThink &&
                  contentParts.normalAfterThink.trim() && (
                    <TouchableOpacity
                      onLongPress={() => {
                        messageManagementSheetRef.current?.present(content);
                      }}
                    >
                      <MarkdownComponent text={contentParts.normalAfterThink} />
                    </TouchableOpacity>
                  )}
                {role === 'assistant' && (
                  <Text style={styles.metadata}>
                    {
                      tokensPerSecond !== undefined && tokensPerSecond !== 0
                        ? `ttft: ${timeToFirstToken?.toFixed()} ms, tps: ${tokensPerSecond?.toFixed(
                            2
                          )} tok/s`
                        : '\u00A0' /* non-breaking space to reserve height */
                    }
                  </Text>
                )}
              </View>
            )}
          </Animated.View>
          <MessageManagementSheet
            bottomSheetModalRef={messageManagementSheetRef}
          />
        </>
      )}
    </>
  );
};

export default MessageItem;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    aiMessage: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 24,
      width: '90%',
      alignSelf: 'flex-start',
    },
    userMessage: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      maxWidth: '65%',
      alignSelf: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: theme.bg.softSecondary,
    },
    eventMessage: {
      paddingHorizontal: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      flexDirection: 'row',
    },
    eventMessageFileName: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      color: theme.text.defaultSecondary,
      textAlign: 'center',
    },
    eventMessageText: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      color: theme.text.defaultTertiary,
      textAlign: 'center',
    },
    bubbleContent: {
      width: '100%',
      gap: 4,
    },
    modelName: {
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.medium,
      color: theme.text.defaultSecondary,
    },
    metadata: {
      fontSize: fontSizes.xxs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultTertiary,
    },
    loadingWrapper: {
      height: 20,
      justifyContent: 'center',
      paddingTop: 4,
    },
  });
