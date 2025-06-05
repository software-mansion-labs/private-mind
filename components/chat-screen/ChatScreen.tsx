import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useModelStore } from '../../store/modelStore';
import { useLLMStore } from '../../store/llmStore';
import { useChatStore } from '../../store/chatStore';
import { type Message } from '../../database/chatRepository';
import { Model } from '../../database/modelRepository';
import Messages from './Messages';
import ChatInputBar from './ChatInputBar';
import ModelSelectorModal from './ModelSelector';
import { useTheme } from '../../context/ThemeContext';
import { router } from 'expo-router';

interface Props {
  chatId: number | null;
  messageHistory: Message[];
  model: Model | null;
  selectModel?: Dispatch<SetStateAction<Model | null>>;
}

export default function ChatScreen({
  chatId,
  messageHistory,
  model,
  selectModel,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const chatIdRef = useRef<number | null>(chatId);
  const { theme } = useTheme();

  const { downloadedModels, loadModels } = useModelStore();
  const { db, isGenerating, loadModel, sendChatMessage } = useLLMStore();
  const { addChat, updateLastUsed } = useChatStore();

  const [userInput, setUserInput] = useState('');
  const [showModelModal, setShowModelModal] = useState(false);

  useEffect(() => {
    loadModels();
  }, [chatId, db, loadModels]);

  const handleSelectModel = async (selectedModel: Model) => {
    setShowModelModal(false);
    try {
      await loadModel(selectedModel);
      selectModel?.(selectedModel);
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

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
    await sendChatMessage(messageHistory, userInput, chatIdRef.current!);
  };

  return (
    <>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 100}
        >
          <View
            style={{
              ...styles.messagesContainer,
              backgroundColor: theme.bg.softPrimary,
            }}
          >
            <Messages
              chatHistory={messageHistory}
              isGenerating={isGenerating}
              model={model}
              onSelectModel={() => setShowModelModal(true)}
            />
          </View>
          <ChatInputBar
            chatId={chatId}
            userInput={userInput}
            setUserInput={setUserInput}
            onSend={handleSendMessage}
            onSelectModel={() => setShowModelModal(true)}
            inputRef={inputRef}
            model={model}
          />
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <ModelSelectorModal
        visible={showModelModal}
        models={downloadedModels}
        onSelect={handleSelectModel}
        onClose={() => setShowModelModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
