import React, { RefObject } from 'react';
import {
  StyleSheet,
  View,
  Text,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
} from 'react-native';
import AnimatedChatLoading from './AnimatedChatLoading';
import MessageItem from './MessageItem';
import { Message } from '../../database/chatRepository';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import { Model } from '../../database/modelRepository';
import SecondaryButton from '../SecondaryButton';
import { ScrollView } from 'react-native-gesture-handler';

interface Props {
  chatHistory: Message[];
  isGenerating: boolean;
  onSelectModel: () => void;
  model: Model | null;
  ref: RefObject<ScrollView | null>;
  isAtBottom: boolean;
  setIsAtBottom: (value: boolean) => void;
}

const Messages = ({
  chatHistory,
  isGenerating,
  onSelectModel,
  model,
  ref,
  isAtBottom,
  setIsAtBottom,
}: Props) => {
  const { theme } = useTheme();
  const isEmpty = chatHistory.length === 0 && !isGenerating;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);

    setIsAtBottom(distanceFromBottom < 50);
  };

  return (
    <View style={styles.container}>
      {!model && isEmpty ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 36,
            gap: 24,
          }}
        >
          <Image
            source={require('../../assets/icons/icon.png')}
            style={{ width: 64, height: 64 }}
          />
          <View style={{ gap: 8 }}>
            <Text
              style={{ ...styles.emptyMessageTitle, color: theme.text.primary }}
            >
              Select a model to start chatting
            </Text>
            <Text
              style={{
                ...styles.emptyMessage,
                color: theme.text.defaultSecondary,
              }}
            >
              Use default models or upload custom ones from your local files or
              external url’s.
            </Text>
          </View>
          <SecondaryButton text="Open a models list" onPress={onSelectModel} />
        </View>
      ) : (
        <ScrollView
          ref={ref}
          onScroll={handleScroll}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="never"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (
              isAtBottom ||
              chatHistory[chatHistory.length - 1].content === ''
            ) {
              ref.current?.scrollToEnd({ animated: true });
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

            {isGenerating && chatHistory.at(-1)?.content === '' && (
              <View style={styles.aiRow}>
                <View style={styles.loadingWrapper}>
                  <AnimatedChatLoading />
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}
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
  emptyMessage: {
    textAlign: 'center',
    lineHeight: lineHeights.sm,
  },
  emptyMessageTitle: {
    fontFamily: fontFamily.medium,
    fontSize: fontSizes.lg,
    lineHeight: lineHeights.lg,
    textAlign: 'center',
  },
});
