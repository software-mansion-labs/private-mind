import React, { RefObject, useMemo } from 'react';
import {
  StyleSheet,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import AnimatedChatLoading from './AnimatedChatLoading';
import MessageItem from './MessageItem';
import { useTheme } from '../../context/ThemeContext';
import { useLLMStore } from '../../store/llmStore';
import { Message } from '../../database/chatRepository';
import { Theme } from '../../styles/colors';

interface Props {
  chatHistory: Message[];
  ref: RefObject<ScrollView | null>;
  isAtBottom: boolean;
  setIsAtBottom: (value: boolean) => void;
}

const Messages = ({ chatHistory, ref, isAtBottom, setIsAtBottom }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { isProcessingPrompt } = useLLMStore();

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    setIsAtBottom(distanceFromBottom < 50);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={ref}
        onScroll={handleScroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="never"
        contentContainerStyle={{ paddingHorizontal: 16 }}
        onContentSizeChange={() => {
          if (
            isAtBottom ||
            chatHistory[chatHistory.length - 1]?.content === ''
          ) {
            ref.current?.scrollToEnd({ animated: true });
          }
        }}
      >
        <View onStartShouldSetResponder={() => true}>
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
        </View>
      </ScrollView>
    </View>
  );
};

export default Messages;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
    },
    aiRow: {
      flexDirection: 'row',
      maxWidth: '85%',
      alignSelf: 'flex-start',
      marginVertical: 8,
      marginHorizontal: 12,
    },
    loadingWrapper: {
      height: 20,
      justifyContent: 'center',
      paddingTop: 4,
    },
  });
