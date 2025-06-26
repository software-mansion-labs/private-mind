import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useModelStore } from '../../store/modelStore';
import { useLLMStore } from '../../store/llmStore';
import { useChatStore } from '../../store/chatStore';
import { type Message } from '../../database/chatRepository';
import { Model } from '../../database/modelRepository';
import Messages from './Messages';
import { useTheme } from '../../context/ThemeContext';
import { router } from 'expo-router';
import ChatBar from './ChatBar';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import ModelSelectSheet from '../bottomSheets/ModelSelectSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  chatId: number | null;
  messageHistory: Message[];
  model: Model | undefined;
  selectModel?: Dispatch<SetStateAction<Model | undefined>>;
}

export default function ChatScreen({
  chatId,
  messageHistory,
  model,
  selectModel,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const chatIdRef = useRef<number | null>(chatId);
  const scrollRef = useRef<ScrollView>(null);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const { theme } = useTheme();

  const { loadModels } = useModelStore();
  const { db, isGenerating, sendChatMessage, loadModel } = useLLMStore();
  const { addChat, updateLastUsed, setChatModel } = useChatStore();

  const [userInput, setUserInput] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadModels();
  }, [chatId, db, loadModels]);

  const handleSendMessage = async () => {
    if (!userInput.trim() || isGenerating) return;

    if (!chatIdRef.current) {
      // truncating new chat title to fixed lenght
      const newChatTitle =
        userInput.length > 25 ? userInput.slice(0, 25) + '...' : userInput;

      const newChatId = await addChat(newChatTitle, model!.id);
      chatIdRef.current = newChatId!;
      router.replace(`/chat/${newChatId}`);
    }
    inputRef.current?.clear();
    setUserInput('');
    updateLastUsed(chatIdRef.current);
    await sendChatMessage(
      messageHistory,
      userInput,
      chatIdRef.current!,
      model!.modelName
    );
  };

  const handleSelectModel = async (selectedModel: Model) => {
    try {
      loadModel(selectedModel);
      if (chatIdRef.current && !model) {
        await setChatModel(chatIdRef.current, selectedModel.id);
      }
      selectModel?.(selectedModel);
      bottomSheetModalRef.current?.dismiss();
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{
        ...styles.container,
        paddingBottom: Platform.OS === 'android' ? 20 : 0,
        backgroundColor: theme.bg.softPrimary,
      }}
      collapsable={false}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 85 + insets.bottom : 40}
    >
      <View
        style={{
          ...styles.messagesContainer,
          backgroundColor: theme.bg.softPrimary,
        }}
      >
        <Messages
          chatHistory={messageHistory}
          model={model}
          onSelectModel={handlePresentModalPress}
          ref={scrollRef}
          isAtBottom={isAtBottom}
          setIsAtBottom={setIsAtBottom}
        />
      </View>
      <ChatBar
        chatId={chatId}
        userInput={userInput}
        setUserInput={setUserInput}
        onSend={handleSendMessage}
        onSelectModel={handlePresentModalPress}
        inputRef={inputRef}
        model={model}
        scrollRef={scrollRef}
        isAtBottom={isAtBottom}
      />
      <ModelSelectSheet
        bottomSheetModalRef={bottomSheetModalRef}
        selectModel={handleSelectModel}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
  },
});
