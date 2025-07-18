import React, { RefObject, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
  Alert,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSQLiteContext } from 'expo-sqlite';
import { router } from 'expo-router';
import AnimatedChatLoading from './AnimatedChatLoading';
import MessageItem from './MessageItem';
import PrimaryButton from '../PrimaryButton';
import TextButton from '../TextButton';
import { useTheme } from '../../context/ThemeContext';
import { useLLMStore } from '../../store/llmStore';
import { useChatStore } from '../../store/chatStore';
import { importMessages, Message } from '../../database/chatRepository';
import { Model } from '../../database/modelRepository';
import { importChatRoom } from '../../database/exportImportRepository';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontFamily';
import { Theme } from '../../styles/colors';

interface Props {
  chatHistory: Message[];
  onSelectModel: () => void;
  model: Model | undefined;
  ref: RefObject<ScrollView | null>;
  isAtBottom: boolean;
  setIsAtBottom: (value: boolean) => void;
}

const Messages = ({
  chatHistory,
  onSelectModel,
  model,
  ref,
  isAtBottom,
  setIsAtBottom,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const db = useSQLiteContext();
  const { isProcessingPrompt } = useLLMStore();
  const isEmpty = chatHistory.length === 0 && !isProcessingPrompt;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    setIsAtBottom(distanceFromBottom < 50);
  };

  const handleImport = async () => {
    const importedChat = await importChatRoom();
    if (importedChat) {
      try {
        const newChatId = await useChatStore
          .getState()
          .addChat(importedChat.title, -1);
        if (newChatId) {
          await importMessages(db!, newChatId, importedChat.messages);
          router.replace(`/chat/${newChatId}`);
        }
      } catch (error) {
        console.error('Error importing chat:', error);
        Alert.alert('Error', 'Failed to import chat. Please try again.');
      }
    }
  };

  return (
    <View style={styles.container}>
      {!model && isEmpty ? (
        <View style={styles.emptyContainer}>
          <Image
            source={require('../../assets/icons/icon.png')}
            style={styles.icon}
          />
          <View style={styles.emptyTextContainer}>
            <Text style={styles.emptyMessageTitle}>
              Select a model to start chatting
            </Text>
            <Text style={styles.emptyMessage}>
              Use default models or upload custom ones from your local files or
              external URLs.
            </Text>
          </View>
          <View style={styles.buttonGroup}>
            <PrimaryButton text="Open a models list" onPress={onSelectModel} />
            <TextButton
              text="Import chat"
              onPress={handleImport}
              style={styles.flatButton}
            />
          </View>
        </View>
      ) : (
        <ScrollView
          ref={ref}
          onScroll={handleScroll}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="never"
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
      )}
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
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 36,
      gap: 24,
    },
    icon: {
      width: 64,
      height: 64,
      borderRadius: 12,
    },
    emptyTextContainer: {
      gap: 8,
    },
    emptyMessage: {
      textAlign: 'center',
      color: theme.text.defaultSecondary,
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.regular,
      lineHeight: lineHeights.sm,
    },
    emptyMessageTitle: {
      textAlign: 'center',
      color: theme.text.primary,
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      lineHeight: lineHeights.lg,
    },
    buttonGroup: {
      gap: 8,
      width: '100%',
    },
    flatButton: {
      borderWidth: 0,
    },
  });
