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
import AnimatedChatLoading from './AnimatedChatLoading';
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

  // Prepare data for FlatList - reverse messages and add loading indicator (inverted style)
  const flatListData = useMemo(() => {
    const messages: MessageWithType[] = [...safeHistory].reverse().map((msg) => ({
      ...msg,
      type: 'message' as const,
    }));

    // Add loading indicator at the beginning (will appear at bottom due to inversion)
    if (isProcessingPrompt) {
      messages.unshift({
        id: -999999, // Unique ID for loading
        role: 'assistant' as const,
        content: '',
        chatId: 0,
        timestamp: 0,
        type: 'loading' as const,
      });
    }

    return messages;
  }, [safeHistory, isProcessingPrompt]);

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
      if (item.type === 'loading') {
        return (
          <View style={styles.aiRow}>
            <View style={styles.loadingWrapper}>
              <AnimatedChatLoading />
            </View>
          </View>
        );
      }

      // Calculate original index for isLastMessage (inverted list)
      const reversedIndex = isProcessingPrompt ? index - 1 : index;
      const originalIndex = safeHistory.length - 1 - reversedIndex;
      const isLastMessage = originalIndex === safeHistory.length - 1;

      return (
        <MessageItem
          content={item.content}
          modelName={item.modelName}
          role={item.role}
          tokensPerSecond={item.tokensPerSecond}
          timeToFirstToken={item.timeToFirstToken}
          isLastMessage={isLastMessage}
        />
      );
    },
    [safeHistory.length, isProcessingPrompt]
  );


  const keyExtractor = useCallback((item: MessageWithType, index: number) => {
    if (item.type === 'loading') return 'loading';
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
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          isProcessingPrompt && styles.scrollContentWithLoading,
        ]}
        inverted
        keyboardShouldPersistTaps="never"
        showsVerticalScrollIndicator={true}
        // Performance optimizations
        removeClippedSubviews={false} // Keep this false for chat to prevent visual issues
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={15}
        // This helps prevent jumping when content changes
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
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
    },
    scrollContent: {
      paddingHorizontal: 16,
      // For inverted FlatList, we want content to grow from bottom
      flexGrow: 1,
    },
    scrollContentWithLoading: {
      paddingBottom: 24, // Extra padding when loading dots are shown
    },
    aiRow: {
      flexDirection: 'row',
      maxWidth: '85%',
      alignSelf: 'flex-start',
      marginVertical: 8,
    },
    loadingWrapper: {
      height: 20,
      justifyContent: 'center',
      paddingTop: 4,
    },
  });
