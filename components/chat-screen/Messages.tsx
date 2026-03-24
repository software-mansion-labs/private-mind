import React, { useRef, useMemo, useCallback, useState } from 'react';
import {
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
  View,
} from 'react-native';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import Reanimated from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import AnimatedChatLoading from './AnimatedChatLoading';
import MessageItem from './MessageItem';
import { useTheme } from '../../context/ThemeContext';
import { useLLMStore } from '../../store/llmStore';
import { Message } from '../../database/chatRepository';
import { Theme } from '../../styles/colors';

interface Props {
  chatHistory: Message[];
  extraContentPadding: SharedValue<number>;
  blankSpace: SharedValue<number>;
  onContentSizeChange?: (w: number, h: number) => void;
}

const Messages = ({
  chatHistory,
  extraContentPadding,
  blankSpace,
  onContentSizeChange,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollRef = useRef<Reanimated.ScrollView>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const { isProcessingPrompt } = useLLMStore();

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      setIsAtBottom(distanceFromBottom < 50);
    },
    []
  );

  const handleContentSizeChange = useCallback(
    (w: number, h: number) => {
      onContentSizeChange?.(w, h);

      if (isAtBottom) {
        scrollRef.current?.scrollToEnd({ animated: true });
      }
    },
    [isAtBottom, onContentSizeChange]
  );

  return (
    <KeyboardChatScrollView
      ref={scrollRef}
      keyboardLiftBehavior="whenAtEnd"
      extraContentPadding={extraContentPadding}
      blankSpace={blankSpace}
      applyWorkaroundForContentInsetHitTestBug
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="never"
      contentContainerStyle={styles.contentContainer}
      onScroll={handleScroll}
      onContentSizeChange={handleContentSizeChange}
      scrollEventThrottle={16}
      style={styles.container}
    >
      {chatHistory.map((message, index) => {
        const isLastMessage = index === chatHistory.length - 1;
        return (
          <MessageItem
            key={`${message.role}-${index}`}
            content={message.content}
            modelName={message.modelName}
            role={message.role}
            tokensPerSecond={message.tokensPerSecond}
            timeToFirstToken={message.timeToFirstToken}
            isLastMessage={isLastMessage}
            imagePath={message.imagePath}
            documentName={message.documentName}
          />
        );
      })}
      {isProcessingPrompt && (
        <View style={styles.aiRow}>
          <View style={styles.loadingWrapper}>
            <AnimatedChatLoading />
          </View>
        </View>
      )}
    </KeyboardChatScrollView>
  );
};

export default Messages;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
    },
    contentContainer: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
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
