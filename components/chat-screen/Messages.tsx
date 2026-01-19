import React, { useMemo } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  FadeIn,
  FadeOut,
  AnimatedRef,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedLegendList } from '@legendapp/list/reanimated';
import MessageItem from './MessageItem';
import { useTheme } from '../../context/ThemeContext';
import { Message } from '../../database/chatRepository';
import { Theme } from '../../styles/colors';
import { useMessageListContext } from '../../context/MessageListContext';
import { useInitialScrollToEnd } from '../../hooks/useInitialScrollToEnd';
import { LegendListRef } from '@legendapp/list';
import { useKeyboardAwareMessageList } from '../../hooks/useKeyboardAwareMessageList';
import { useMessageBlankSize } from '../../hooks/useMessageBlankSize';

interface Props {
  isLoading: boolean;
  chatHistory: Message[];
  isAtBottom: boolean;
  setIsAtBottom: (value: boolean) => void;
  chatListRef: AnimatedRef<LegendListRef>;
}

const Messages = ({
  isLoading,
  chatHistory,
  isAtBottom,
  setIsAtBottom,
  chatListRef,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    containerHeight,
    assistantMessageHeight,
    blankSize,
    lastUserMessageHeight,
  } = useMessageListContext();

  // Handle keyboard-aware scrolling
  const { keyboardHeight, keyboardProgress } = useKeyboardAwareMessageList({
    chatListRef,
    isAtBottom,
    blankSize,
  });

  const hasScrolledToEnd = useInitialScrollToEnd(
    blankSize,
    isLoading,
    chatListRef
  );

  const listOpacityStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(!hasScrolledToEnd.value ? 0 : 1, { duration: 200 }),
    };
  });

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    setIsAtBottom(distanceFromBottom < 100);
  };

  const handleContentSizeChange = (width: number, height: number) => {
    const scrollView = chatListRef.current;
    if (scrollView) {
      const state = scrollView.getState?.();
      if (state) {
        const { scroll, scrollLength } = state;
        const distanceFromBottom = height - (scroll + scrollLength);
        const wasAtBottom = distanceFromBottom < 100;
        setIsAtBottom(wasAtBottom);
      }
    }
  };

  // Calculate and manage blank space size
  const { animatedFooterStyle } = useMessageBlankSize({
    containerHeight,
    assistantMessageHeight,
    lastUserMessageHeight,
    keyboardHeight,
    keyboardProgress,
    blankSize,
  });

  const handleScrollToBottom = () => {
    chatListRef.current?.scrollToEnd({ animated: true });
  };

  return (
    <Animated.View
      style={[styles.container]}
      onLayout={(event) => {
        if (event.nativeEvent.layout.height > containerHeight.value) {
          containerHeight.value = event.nativeEvent.layout.height;
        }
      }}
    >
      <AnimatedLegendList
        extraData={{
          lastThree: chatHistory.length,
        }}
        ref={chatListRef}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        keyboardShouldPersistTaps="never"
        enableAverages={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ListFooterComponent={<Animated.View style={animatedFooterStyle} />}
        style={listOpacityStyle}
        data={chatHistory}
        keyExtractor={(item, index) => {
          return index.toString();
        }}
        renderItem={({ item, index }) => {
          const isLastMessage = index === chatHistory.length - 1;

          const isLastUserMessage =
            item.role === 'user' &&
            index === chatHistory.findLastIndex((m) => m.role === 'user');
          const isLastAssistantMessage =
            item.role === 'assistant' &&
            index === chatHistory.findLastIndex((m) => m.role === 'assistant');

          return (
            <MessageItem
              id={item.id}
              content={item.content}
              modelName={item.modelName}
              role={item.role}
              tokensPerSecond={item.tokensPerSecond}
              timeToFirstToken={item.timeToFirstToken}
              isLastMessage={isLastMessage}
              isLastUserMessage={isLastUserMessage}
              isLastAssistantMessage={isLastAssistantMessage}
            />
          );
        }}
      />

      {/* Scroll to bottom button */}
      {!isAtBottom && hasScrolledToEnd.value && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.scrollToBottomButton}
        >
          <TouchableOpacity
            onPress={handleScrollToBottom}
            style={styles.scrollToBottomTouchable}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-down" size={20} color={theme.text.primary} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
};

export default Messages;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
    },
    scrollToBottomButton: {
      position: 'absolute',
      bottom: 16,
      alignSelf: 'center',
      zIndex: 10,
    },
    scrollToBottomTouchable: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.bg.softSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
