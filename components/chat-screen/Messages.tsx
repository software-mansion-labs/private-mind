import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import AnimatedChatLoading from './AnimatedChatLoading';
import MessageItem from './MessageItem';
import ColorPalette from '../../colors';
import { Message } from '../../database/chatRepository';

interface Props {
  chatHistory: Message[];
  isGenerating: boolean;
}

const Messages = ({ chatHistory, isGenerating }: Props) => {
  const scrollRef = useRef<ScrollView>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isEmpty = chatHistory.length === 0 && !isGenerating;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);

    setIsAtBottom(distanceFromBottom < 50);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        onScroll={handleScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (isAtBottom) {
            scrollRef.current?.scrollToEnd({ animated: true });
          }
        }}
      >
        <View onStartShouldSetResponder={() => true}>
          {chatHistory.map((message, index) => (
            <MessageItem
              key={`${message.role}-${index}`}
              content={message.content}
              modelName={message.modelName}
              role={message.role}
              tokensPerSecond={message.tokensPerSecond}
              timeToFirstToken={message.timeToFirstToken}
            />
          ))}

          {isGenerating && (
            <View style={styles.aiRow}>
              <View style={styles.loadingWrapper}>
                <AnimatedChatLoading />
              </View>
            </View>
          )}

          {isEmpty && (
            <Text style={styles.emptyState}>
              Start a conversation to see messages here.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default Messages;

const styles = StyleSheet.create({
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
  emptyState: {
    textAlign: 'center',
    color: ColorPalette.blueDark,
    marginTop: 24,
    fontStyle: 'italic',
    fontSize: 13,
  },
});
