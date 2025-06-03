import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useModelStore } from '../../store/modelStore';
import { useLLMStore } from '../../store/llmStore';
import { useChatStore } from '../../store/chatStore';
import { type Message } from '../../database/chatRepository';
import { Model } from '../../database/modelRepository';
import Messages from './Messages';
import ChatInputBar from './ChatInputBar';
import ModelSelectorModal from './ModelSelector';

interface Props {
  chatId: number | null;
  messageHistory: Message[];
}

export default function ChatScreen({ chatId, messageHistory }: Props) {
  const inputRef = useRef<TextInput>(null);
  const chatIdRef = useRef<number | null>(chatId);

  const { downloadedModels, loadModels } = useModelStore();
  const {
    db,
    model,
    loadModel,
    isLoading,
    isGenerating,
    sendChatMessage,
    setActiveChatId,
    interrupt,
  } = useLLMStore();
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
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isGenerating) return;

    if (chatIdRef.current) {
      setActiveChatId(chatIdRef.current);
    } else {
      // truncating new chat title to fixed lenght
      const newChatTitle =
        userInput.length > 25 ? userInput.slice(0, 25) + '...' : userInput;

      const newChatId = await addChat(newChatTitle);
      chatIdRef.current = newChatId!;
      setActiveChatId(chatIdRef.current);
      router.replace(`/chat/${newChatId}`);
    }

    inputRef.current?.clear();
    setUserInput('');
    updateLastUsed(chatIdRef.current);
    await sendChatMessage(messageHistory, userInput);
  };

  return (
    <>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 100}
        >
          <View style={styles.messagesContainer}>
            <Messages
              chatHistory={messageHistory}
              isGenerating={isGenerating}
            />
          </View>
          <ChatInputBar
            isLoading={isLoading}
            isGenerating={isGenerating}
            selectedModel={model}
            userInput={userInput}
            setUserInput={setUserInput}
            onSend={handleSendMessage}
            onSelectModel={() => setShowModelModal(true)}
            inputRef={inputRef}
            interrupt={interrupt}
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
    backgroundColor: '#fff',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fdfdfd',
  },
});
