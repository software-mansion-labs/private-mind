import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  Pressable,
  Linking,
} from 'react-native';
import MarkdownComponent from './MarkdownComponent';
import ThinkingBlock from './ThinkingBlock';
import AnimatedChatLoading from './AnimatedChatLoading';
import SourcesSheet, { type SourcesSheetHandle } from './SourcesSheet';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { useLLMStore } from '../../store/llmStore';
import { Theme } from '../../styles/colors';
import ImageLightbox from './ImageLightbox';
import AttachmentIcon from '../../assets/icons/attachment.svg';
import BookIcon from '../../assets/icons/book-open.svg';
import { type SourceDocument } from '../../database/chatRepository';
import { stripCitations } from '../../utils/citations';
import { sourceKey } from '../../utils/contextUtils';

interface MessageItemProps {
  content: string;
  role: 'user' | 'assistant' | 'system' | 'event';
  modelName?: string;
  tokensPerSecond?: number;
  timeToFirstToken?: number;
  isLastMessage: boolean;
  imagePath?: string;
  documentName?: string;
  sourceDocuments?: SourceDocument[];
  userQuestion?: string;
}

const THINK_OPEN = '<think>';
const THINK_CLOSE = '</think>';

const parseThinkingContent = (text: string) => {
  const thinkStartIndex = text.indexOf(THINK_OPEN);
  if (thinkStartIndex === -1) {
    return { normalContent: text, thinkingContent: null, hasThinking: false };
  }

  const thinkEndIndex = text.indexOf(THINK_CLOSE);
  const normalBeforeThink = text.slice(0, thinkStartIndex);
  const contentStart = thinkStartIndex + THINK_OPEN.length;

  if (thinkEndIndex === -1) {
    return {
      normalContent: normalBeforeThink,
      thinkingContent: text.slice(contentStart),
      hasThinking: true,
      isThinkingComplete: false,
      normalAfterThink: '',
    };
  }

  return {
    normalContent: normalBeforeThink,
    thinkingContent: text.slice(contentStart, thinkEndIndex),
    hasThinking: true,
    isThinkingComplete: true,
    normalAfterThink: text.slice(thinkEndIndex + THINK_CLOSE.length),
  };
};

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
    sourceDocuments,
    userQuestion,
  }: MessageItemProps) => {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { isGenerating, isProcessingPrompt } = useLLMStore();
    const [lightboxVisible, setLightboxVisible] = useState(false);
    const sourcesSheetRef = useRef<SourcesSheetHandle>(null);

    const contentParts = parseThinkingContent(content);
    const hasSources = !!sourceDocuments?.length;
    const displayedSources = useMemo(() => {
      if (!sourceDocuments?.length) return [];

      const seen = new Set<string>();
      return sourceDocuments.filter((source) => {
        const key = sourceKey(source.documentId, source.name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }, [sourceDocuments]);

    const handleLinkPress = useCallback(({ url }: { url: string }) => {
      Linking.openURL(url).catch(() => {});
    }, []);

    const normalContent = useMemo(
      () =>
        hasSources
          ? stripCitations(contentParts.normalContent)
          : contentParts.normalContent,
      [contentParts.normalContent, hasSources]
    );
    const normalAfterThink = useMemo(
      () =>
        hasSources
          ? stripCitations(contentParts.normalAfterThink ?? '')
          : contentParts.normalAfterThink ?? '',
      [contentParts.normalAfterThink, hasSources]
    );

    const canShowSourcesAction =
      !!content.trim() &&
      displayedSources.length > 0 &&
      !(isLastMessage && (isGenerating || isProcessingPrompt));

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
          <View style={styles.aiMessage}>
            <View style={styles.bubbleContent}>
              {content.trim() ? (
                <Text style={styles.modelName}>{modelName}</Text>
              ) : isLastMessage && isProcessingPrompt ? (
                <AnimatedChatLoading />
              ) : null}
              {contentParts.normalContent.trim() && (
                <MarkdownComponent
                  text={normalContent}
                  streaming={isLastMessage && isGenerating}
                  onLinkPress={handleLinkPress}
                />
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
                  <MarkdownComponent
                    text={normalAfterThink}
                    streaming={isLastMessage && isGenerating}
                    onLinkPress={handleLinkPress}
                  />
                )}
              {tokensPerSecond !== undefined && tokensPerSecond !== 0 && (
                <Text style={styles.metadata}>
                  ttft: {timeToFirstToken?.toFixed()} ms, tps:{' '}
                  {tokensPerSecond?.toFixed(2)} tok/s
                </Text>
              )}
              {canShowSourcesAction && (
                <View style={styles.messageActions} testID="message-actions">
                  <Pressable
                    style={({ pressed }) => [
                      styles.sourcesButton,
                      pressed && styles.sourcesButtonPressed,
                    ]}
                    onPress={() => sourcesSheetRef.current?.present()}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Sources"
                    testID="source-action-button"
                  >
                    <BookIcon
                      width={16}
                      height={16}
                      style={styles.sourcesButtonIcon}
                    />
                    <Text style={styles.sourcesButtonLabel}>Sources</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}
        {role === 'assistant' && canShowSourcesAction && (
          <SourcesSheet
            ref={sourcesSheetRef}
            sources={displayedSources}
            userQuestion={userQuestion}
          />
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
    messageActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
    },
    sourcesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    sourcesButtonPressed: {
      opacity: 0.6,
    },
    sourcesButtonIcon: {
      color: theme.text.primary,
    },
    sourcesButtonLabel: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
  });
