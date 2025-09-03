import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useLLMStore } from '../../store/llmStore';
import { useChatStore } from '../../store/chatStore';
import { useModelStore } from '../../store/modelStore';
import { useTheme } from '../../context/ThemeContext';
import {
  Chat,
  ChatSettings,
  checkIfChatExists,
  getChatSettings,
  type Message,
} from '../../database/chatRepository';
import { Model } from '../../database/modelRepository';
import Messages from './Messages';
import ChatBar from './ChatBar';
import ModelSelectSheet from '../bottomSheets/ModelSelectSheet';
import { Theme } from '../../styles/colors';
import { useSQLiteContext } from 'expo-sqlite';
import { CustomKeyboardAvoidingView } from '../CustomKeyboardAvoidingView';
import { useVectorStore } from '../../context/VectorStoreContext';
import SourceSelectSheet from '../bottomSheets/SourceSelectSheet';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';

interface Props {
  chatId: number;
  chat: Chat | undefined;
  messageHistory: Message[];
  model: Model | undefined;
  selectModel?: (model: Model) => Promise<void>;
}

const K_DOCUMENTS_TO_RETRIEVE = 5;

const prepareContext = async (
  prompt: string,
  enabledSources: number[],
  vectorStore: OPSQLiteVectorStore
) => {
  try {
    let context = await vectorStore.similaritySearch(
      prompt,
      K_DOCUMENTS_TO_RETRIEVE
    );
    context = context.filter((item) => {
      return enabledSources.includes(item.metadata?.documentId);
    });

    const preparedContext = context.map((item) => {
      return `${item.content}`;
    });

    return preparedContext;
  } catch (error) {
    console.error('Error preparing context:', error);
    return [];
  }
};

export default function ChatScreen({
  chatId,
  chat,
  messageHistory,
  model,
  selectModel,
}: Props) {
  const inputRef = useRef<{
    clear: () => void;
    setInput: (text: string) => void;
  }>(null);
  const scrollRef = useRef<ScrollView>(null);
  const modelBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const sourceBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const db = useSQLiteContext();

  const { vectorStore } = useVectorStore();
  const {
    isGenerating,
    sendChatMessage,
    loadModel,
    model: loadedModel,
  } = useLLMStore();
  const { addChat, updateLastUsed, setChatModel, phantomChat } = useChatStore();
  const { getModelById } = useModelStore();

  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [isAtBottom, setIsAtBottom] = useState(true);

  const enabledSources =
    chat?.enabledSources || phantomChat?.enabledSources || [];

  const handlePresentModelSheet = useCallback(() => {
    modelBottomSheetModalRef.current?.present();
  }, []);

  const handlePresentSourceSheet = useCallback(() => {
    sourceBottomSheetModalRef.current?.present();
  }, []);

  const handleSendMessage = async (userInput: string) => {
    if (!userInput.trim() || isGenerating) return;
    if (!(await checkIfChatExists(db, chatId!))) {
      const newChatTitle =
        userInput.length > 25 ? userInput.slice(0, 25) + '...' : userInput;
      await addChat(newChatTitle, model!.id);
    }

    inputRef.current?.clear();
    Keyboard.dismiss();

    updateLastUsed(chatId!);
    const context = await prepareContext(
      userInput,
      enabledSources,
      vectorStore!
    );
    let settings: ChatSettings;
    if (phantomChat?.id === chatId) {
      settings = phantomChat.settings!;
    } else {
      settings = await getChatSettings(db, chatId);
    }

    await sendChatMessage(userInput, chatId!, context, settings);
  };

  const handleSelectModel = async (selectedModel: Model) => {
    try {
      loadModel(selectedModel);

      if (chatId && !model) {
        await setChatModel(chatId, selectedModel.id);
      }

      selectModel?.(selectedModel);
      modelBottomSheetModalRef.current?.dismiss();
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

  const handleSelectPrompt = useCallback(
    async (prompt: string) => {
      inputRef.current?.setInput(prompt);

      const currentModel = model || (chatId ? getModelById(chatId) : undefined);
      if (currentModel?.isDownloaded && loadedModel?.id !== currentModel.id) {
        try {
          await loadModel(currentModel);
        } catch (error) {
          console.error('Error loading model on prompt selection:', error);
        }
      }
    },
    [model, loadedModel, loadModel, getModelById, chatId]
  );

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
          onSend={handleSendMessage}
          onSelectModel={handlePresentModelSheet}
          onSelectSource={handlePresentSourceSheet}
          onSelectPrompt={handleSelectPrompt}
          ref={inputRef}
          model={model}
          scrollRef={scrollRef}
          isAtBottom={isAtBottom}
          activeSourcesCount={enabledSources.length}
          hasMessages={messageHistory.length > 0}
        />
      </View>

      <ModelSelectSheet
        bottomSheetModalRef={modelBottomSheetModalRef}
        selectModel={handleSelectModel}
      />
      <SourceSelectSheet
        bottomSheetModalRef={sourceBottomSheetModalRef}
        enabledSources={enabledSources}
        chatId={chatId}
      />
    </CustomKeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
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
