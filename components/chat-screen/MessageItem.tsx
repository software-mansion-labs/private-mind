import React, { memo, useMemo, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image } from 'react-native';
import MarkdownComponent from './MarkdownComponent';
import ThinkingBlock from './ThinkingBlock';
import AnimatedChatLoading from './AnimatedChatLoading';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { useLLMStore } from '../../store/llmStore';
import { Theme } from '../../styles/colors';
import ImageLightbox from './ImageLightbox';
import AttachmentIcon from '../../assets/icons/attachment.svg';

interface MessageItemProps {
  content: string;
  role: 'user' | 'assistant' | 'system' | 'event';
  modelName?: string;
  tokensPerSecond?: number;
  timeToFirstToken?: number;
  isLastMessage: boolean;
  imagePath?: string;
  documentName?: string;
}

const MessageItem = memo(
  ({
    content,
    modelName,
    role,
    tokensPerSecond,
    timeToFirstToken,
    isLastMessage = false,
    imagePath,
    documentName,
  }: MessageItemProps) => {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { isGenerating, isProcessingPrompt } = useLLMStore();
    const [lightboxVisible, setLightboxVisible] = useState(false);

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
        ) : role === 'user' ? (
          <View style={styles.userMessageGroup}>
            {imagePath && (
              <View style={styles.userBubble} testID="image-bubble">
                <TouchableOpacity
                  onPress={() => setLightboxVisible(true)}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: imagePath }}
                    style={styles.messageImage}
                    resizeMode="cover"
                    testID="message-image"
                  />
                </TouchableOpacity>
                <ImageLightbox
                  uri={imagePath}
                  visible={lightboxVisible}
                  onClose={() => setLightboxVisible(false)}
                />
              </View>
            )}
            {documentName && (
              <View style={styles.userBubble} testID="document-bubble">
                <View style={styles.documentTile} testID="message-document">
                  <AttachmentIcon
                    width={28}
                    height={28}
                    style={{ color: theme.text.primary }}
                  />
                  <Text style={styles.documentName} numberOfLines={2}>
                    {documentName}
                  </Text>
                </View>
              </View>
            )}
            {contentParts.normalContent.trim() && (
              <View style={styles.userBubble} testID="text-bubble">
                <View style={styles.userMessageContent}>
                  <Text style={styles.userText} selectable>
                    {contentParts.normalContent}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.aiMessage}>
              <View style={styles.bubbleContent}>
                {content.trim() ? (
                  <Text style={styles.modelName}>{modelName}</Text>
                ) : isLastMessage && isProcessingPrompt ? (
                  <AnimatedChatLoading />
                ) : null}
                {contentParts.normalContent.trim() && (
                  <MarkdownComponent text={contentParts.normalContent} />
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
                    <MarkdownComponent text={contentParts.normalAfterThink} />
                  )}
                {tokensPerSecond !== undefined && tokensPerSecond !== 0 && (
                  <Text style={styles.metadata}>
                    ttft: {timeToFirstToken?.toFixed()} ms, tps:{' '}
                    {tokensPerSecond?.toFixed(2)} tok/s
                  </Text>
                )}
              </View>
            </View>
          </>
        )}
      </>
    );
  }
);

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
    userMessageGroup: {
      alignItems: 'flex-end',
      marginBottom: 24,
      gap: 4,
    },
    userBubble: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
      maxWidth: '65%',
      borderRadius: 12,
      backgroundColor: theme.bg.softSecondary,
      overflow: 'hidden',
    },
    userMessageContent: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      width: '100%',
    },
    messageImage: {
      width: '100%',
      aspectRatio: 4 / 3,
    },
    documentTile: {
      width: '100%',
      paddingVertical: 20,
      backgroundColor: theme.bg.overlay,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
    },
    documentName: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
      flex: 1,
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
    userText: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      color: theme.text.primary,
      lineHeight: lineHeights.md,
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
  });
