import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Image,
  Pressable,
  Linking,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import MarkdownComponent from './MarkdownComponent';
import ThinkingBlock from './ThinkingBlock';
import AnimatedChatLoading from './AnimatedChatLoading';
import WebSearchBlock from './WebSearchBlock';
import { WEB_TRACE_TRANSITION_MS } from './webSearchTraceConstants';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useWebSearchActivity } from '../../hooks/useWebSearchActivity';
import { useMessageSources } from '../../hooks/useMessageSources';
import { Theme } from '../../styles/colors';
import ImageLightbox from './ImageLightbox';
import AttachmentIcon from '../../assets/icons/attachment.svg';
import BookIcon from '../../assets/icons/book-open.svg';
import CopyIcon from '../../assets/icons/copy.svg';
import ForkIcon from '../../assets/icons/fork.svg';
import MessageActionButton from './MessageActionButton';
import {
  MESSAGE_ACTION_ROW_HEIGHT,
  SUPPORTS_USER_ACTION_MENU,
} from '../../constants/chat-screen';
import { Message, type SourceDocument } from '../../database/chatRepository';
import { stripCitations } from '../../utils/citations';

interface MessageItemProps {
  message: Message;
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
  onShowSources?: (sources: SourceDocument[], userQuestion?: string) => void;
  showActions?: boolean;
  showForkAction?: boolean;
  onCopy?: (message: Message) => void;
  onFork?: (message: Message) => void;
}

const splitDocumentName = (name: string) => {
  const dotIndex = name.lastIndexOf('.');
  const extension = dotIndex > 0 ? name.slice(dotIndex + 1) : '';

  if (!extension || extension.length > 5) {
    return { title: name, type: 'Document' };
  }

  return { title: name.slice(0, dotIndex), type: extension.toUpperCase() };
};

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
    message,
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
    onShowSources,
    showActions = false,
    showForkAction = false,
    onCopy,
    onFork,
  }: MessageItemProps) => {
    const { styles } = useThemedStyles(createStyles);
    const [lightboxVisible, setLightboxVisible] = useState(false);

    const contentParts = parseThinkingContent(content);
    const { displayedSources, webResults, documentSources, hasSources } =
      useMessageSources(sourceDocuments);

    const documentInfo = useMemo(
      () => (documentName ? splitDocumentName(documentName) : null),
      [documentName]
    );

    const handleLinkPress = useCallback(({ url }: { url: string }) => {
      if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) return;
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
          : (contentParts.normalAfterThink ?? ''),
      [contentParts.normalAfterThink, hasSources]
    );

    const {
      isGenerating,
      isBusy,
      isSearchingThis,
      isAwaitingFirstToken,
      trace: webSearchTrace,
      webActive,
    } = useWebSearchActivity({
      isLastMessage,
      content,
      hasWebResults: webResults.length > 0,
    });
    const canShowSourcesAction =
      !!content.trim() && documentSources.length > 0 && !isBusy;

    const actions =
      showActions || canShowSourcesAction ? (
        <View style={styles.actionRow} testID="message-actions">
          {showActions && (
            <MessageActionButton
              label="Copy"
              icon={CopyIcon}
              onPress={() => onCopy?.(message)}
            />
          )}
          {showActions && showForkAction && (
            <MessageActionButton
              label="Fork"
              icon={ForkIcon}
              onPress={() => onFork?.(message)}
            />
          )}
          {canShowSourcesAction && (
            <Pressable
              style={({ pressed }) => [
                styles.sourcesButton,
                pressed && styles.sourcesButtonPressed,
              ]}
              onPress={() => onShowSources?.(displayedSources, userQuestion)}
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
          )}
        </View>
      ) : null;

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
                <Pressable
                  onPress={() => setLightboxVisible(true)}
                  style={({ pressed }) => pressed && styles.imagePressed}
                >
                  <Image
                    source={{ uri: imagePath }}
                    style={styles.messageImage}
                    resizeMode="cover"
                    testID="message-image"
                  />
                </Pressable>
                <ImageLightbox
                  uri={imagePath}
                  visible={lightboxVisible}
                  onClose={() => setLightboxVisible(false)}
                />
              </View>
            )}
            {documentName && (
              <View style={styles.documentCard} testID="document-bubble">
                <AttachmentIcon
                  width={22}
                  height={22}
                  style={styles.documentIcon}
                />
                <View style={styles.documentMeta} testID="message-document">
                  <Text style={styles.documentName} numberOfLines={1}>
                    {documentInfo?.title}
                  </Text>
                  <Text style={styles.documentType} numberOfLines={1}>
                    {documentInfo?.type}
                  </Text>
                </View>
              </View>
            )}
            {contentParts.normalContent.trim() && (
              <View style={styles.userBubble} testID="text-bubble">
                <View style={styles.userMessageContent}>
                  <Text
                    style={styles.userText}
                    selectable={!SUPPORTS_USER_ACTION_MENU}
                  >
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
                <Animated.Text
                  style={styles.modelName}
                  entering={FadeIn.duration(WEB_TRACE_TRANSITION_MS)}
                >
                  {modelName}
                </Animated.Text>
              ) : null}
              {webActive && (
                <WebSearchBlock
                  isSearching={isSearchingThis}
                  trace={webSearchTrace}
                  results={webResults}
                />
              )}
              {isAwaitingFirstToken ? (
                <AnimatedChatLoading inline={webActive} label="Thinking…" />
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
              {actions}
            </View>
          </View>
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
    documentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      maxWidth: '75%',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border.soft,
      backgroundColor: theme.bg.softSecondary,
    },
    documentIcon: {
      color: theme.text.defaultSecondary,
    },
    documentMeta: {
      flexShrink: 1,
      paddingRight: 4,
    },
    documentName: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.primary,
    },
    documentType: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xxs,
      lineHeight: lineHeights.xs,
      letterSpacing: 0.8,
      color: theme.text.defaultTertiary,
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
    sourcesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 4,
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
      lineHeight: 16,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
      includeFontPadding: false,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
      minHeight: MESSAGE_ACTION_ROW_HEIGHT,
    },
    imagePressed: {
      opacity: 0.9,
    },
  });
