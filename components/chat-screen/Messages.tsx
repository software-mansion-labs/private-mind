import React, {
  RefObject,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ListRenderItem,
} from 'react-native';
import MessageItem from './MessageItem';
import { useTheme } from '../../context/ThemeContext';
import { useLLMStore } from '../../store/llmStore';
import { Message } from '../../database/chatRepository';
import { Theme } from '../../styles/colors';

type MessageWithType = Message & { type?: 'message' | 'loading' };

interface Props {
  chatHistory: Message[];
  ref: RefObject<FlatList | null>;
  isAtBottom: boolean;
  setIsAtBottom: (value: boolean) => void;
}

const Messages = ({ chatHistory, ref, isAtBottom, setIsAtBottom }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { isProcessingPrompt } = useLLMStore();

  const safeHistory = chatHistory || [];
  const previousChatLength = useRef(safeHistory.length);
  const previousLastMessageContent = useRef(
    safeHistory[safeHistory.length - 1]?.content || ''
  );
  const userScrollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const isUserScrolling = useRef(false);

  // Prepare data for FlatList - reverse messages (inverted style)
  const flatListData = useMemo(() => {
    const messages: MessageWithType[] = [...safeHistory]
      .reverse()
      .map((msg) => ({
        ...msg,
        type: 'message' as const,
      }));

    return messages;
  }, [safeHistory]);

  // Auto-scroll behavior like standard chat apps
  useEffect(() => {
    const currentLength = safeHistory.length;
    const currentLastMessageContent =
      safeHistory[safeHistory.length - 1]?.content || '';

    // Check if new message was added or existing message content changed
    const hasNewMessage = currentLength > previousChatLength.current;
    const hasContentUpdate =
      currentLastMessageContent !== previousLastMessageContent.current;

    if (hasNewMessage && isAtBottom) {
      // Only scroll to new message when user is at bottom (inverted FlatList - offset 0 is bottom)
      ref.current?.scrollToOffset({ offset: 0, animated: true });
    } else if (hasContentUpdate && isAtBottom && !isUserScrolling.current) {
      // Only auto-scroll for content updates when at bottom and user not scrolling
      ref.current?.scrollToOffset({ offset: 0, animated: true });
    }

    // Update refs for next comparison
    previousChatLength.current = currentLength;
    previousLastMessageContent.current = currentLastMessageContent;
  }, [safeHistory, ref, isAtBottom, flatListData.length]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (userScrollingTimeoutRef.current) {
        clearTimeout(userScrollingTimeoutRef.current);
      }
    };
  }, []);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    // For inverted FlatList, we're at "bottom" when offset is near 0
    setIsAtBottom(contentOffset.y < 50);

    // Mark user as scrolling and reset timeout
    isUserScrolling.current = true;
    if (userScrollingTimeoutRef.current) {
      clearTimeout(userScrollingTimeoutRef.current);
    }

    // Clear scrolling flag after user stops scrolling
    userScrollingTimeoutRef.current = setTimeout(() => {
      isUserScrolling.current = false;
    }, 150);
  };

  const renderMessage: ListRenderItem<MessageWithType> = useCallback(
    ({ item, index }) => {
      // For inverted FlatList, the first index (0) is the last message
      const isLastMessage = index === 0;

      // Check if this is the last message and we're processing (loading state)
      const isLoading =
        isLastMessage && isProcessingPrompt && item.role === 'assistant';

      return (
        <MessageItem
          content={item.content}
          modelName={item.modelName}
          role={item.role}
          tokensPerSecond={item.tokensPerSecond}
          timeToFirstToken={item.timeToFirstToken}
          isLastMessage={isLastMessage}
          isLoading={isLoading}
        />
      );
    },
    [safeHistory.length, isProcessingPrompt]
  );

  const keyExtractor = useCallback((item: MessageWithType, index: number) => {
    return `${item.role}-${item.id}-${index}`;
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        ref={ref}
        data={flatListData}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        onScroll={handleScroll}
        contentContainerStyle={styles.scrollContent}
        style={styles.flatList}
        keyboardShouldPersistTaps="never"
        showsVerticalScrollIndicator={true}
        inverted
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
        // Performance optimizations
        removeClippedSubviews={false} // Keep this false for chat to prevent visual issues
      />
    </View>
  );
};

export default Messages;

const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
      justifyContent: 'flex-start', // Start from top
    },
    flatList: {
      flexGrow: 0, // Don't grow to fill container
      flexShrink: 1, // Allow shrinking if needed
    },
    scrollContent: {
      paddingHorizontal: 16,
    },
  });
