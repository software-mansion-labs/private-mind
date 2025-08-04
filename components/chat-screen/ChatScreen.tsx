import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useModelStore } from '../../store/modelStore';
import { useLLMStore } from '../../store/llmStore';
import { useChatStore } from '../../store/chatStore';
import { useTheme } from '../../context/ThemeContext';
import { checkIfChatExists, type Message } from '../../database/chatRepository';
import { Model } from '../../database/modelRepository';
import Messages from './Messages';
import ChatBar from './ChatBar';
import ModelSelectSheet from '../bottomSheets/ModelSelectSheet';
import { Theme } from '../../styles/colors';
import { useSQLiteContext } from 'expo-sqlite';
import { CustomKeyboardAvoidingView } from '../CustomKeyboardAvoidingView';

interface Props {
  chatId: number | null;
  messageHistory: Message[];
  model: Model | undefined;
  selectModel?: (model: Model) => Promise<void>;
}

export default function ChatScreen({
  chatId,
  messageHistory,
  model,
  selectModel,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const db = useSQLiteContext();

  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { loadModels } = useModelStore();
  const { isGenerating, sendChatMessage, loadModel } = useLLMStore();
  const { addChat, updateLastUsed, setChatModel } = useChatStore();

  const [userInput, setUserInput] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);

  useEffect(() => {
    loadModels();
  }, [chatId, loadModels]);

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const handleSendMessage = async () => {
    if (!userInput.trim() || isGenerating) return;
    if (!(await checkIfChatExists(db, chatId!))) {
      const newChatTitle =
        userInput.length > 25 ? userInput.slice(0, 25) + '...' : userInput;
      await addChat(newChatTitle, model!.id);
    }

    inputRef.current?.clear();
    Keyboard.dismiss();

    setUserInput('');
    updateLastUsed(chatId!);

    await sendChatMessage(userInput, chatId!);
  };

  const handleSelectModel = async (selectedModel: Model) => {
    try {
      loadModel(selectedModel);

      if (chatId && !model) {
        await setChatModel(chatId, selectedModel.id);
      }

      selectModel?.(selectedModel);
      bottomSheetModalRef.current?.dismiss();
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

  return (
    <CustomKeyboardAvoidingView style={styles.container} collapsable={false}>
      <View style={styles.messagesContainer}>
        <Messages
          chatHistory={messageHistory}
          ref={scrollRef}
          isAtBottom={isAtBottom}
          setIsAtBottom={setIsAtBottom}
        />
      </View>

      <View style={styles.barContainer}>
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
      </View>

      <ModelSelectSheet
        bottomSheetModalRef={bottomSheetModalRef}
        selectModel={handleSelectModel}
      />
    </CustomKeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
      paddingHorizontal: 16,
    },
    messagesContainer: {
      flex: 1,
      paddingTop: 16,
      paddingBottom: 8,
      backgroundColor: theme.bg.softPrimary,
    },
    barContainer: {
      paddingBottom: theme.insets.bottom + 16,
    },
  });
