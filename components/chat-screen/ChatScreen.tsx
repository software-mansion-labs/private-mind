import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Keyboard, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSharedValue } from 'react-native-reanimated';
import { useLLMStore } from '../../store/llmStore';
import { useChatStore } from '../../store/chatStore';
import { useModelStore } from '../../store/modelStore';
import { useTheme } from '../../context/ThemeContext';
import {
  Chat,
  ChatSettings,
  checkIfChatExists,
  setChatSettings,
  type Message,
} from '../../database/chatRepository';
import { Model } from '../../database/modelRepository';
import Messages from './Messages';
import ChatBar from './ChatBar';
import ModelSelectSheet from '../bottomSheets/ModelSelectSheet';
import { Theme } from '../../styles/colors';
import { useSQLiteContext } from 'expo-sqlite';
import { useVectorStore } from '../../context/VectorStoreContext';
import SourceSelectSheet from '../bottomSheets/SourceSelectSheet';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import useChatSettings from '../../hooks/useChatSettings';
import Toast from 'react-native-toast-message';

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
    const context = await vectorStore.query({
      queryText: prompt,
      nResults: K_DOCUMENTS_TO_RETRIEVE,
      predicate: (r) => enabledSources.includes(r.metadata?.documentId),
    });

    context.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    const preparedContext = context.map((item, index) => {
      const documentName =
        item.metadata?.name ||
        `Document ${item.metadata?.documentId || 'Unknown'}`;
      const relevanceScore = item.similarity
        ? `(Relevance: ${(item.similarity * 100).toFixed(1)}%)`
        : '';

      return `\n --- Source ${
        index + 1
      }: ${documentName} ${relevanceScore} --- \n ${item.document?.trim()} \n --- End of Source ${
        index + 1
      } ---`;
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
  const modelBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const sourceBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const db = useSQLiteContext();

  const { vectorStore } = useVectorStore();
  const {
    isGenerating,
    isProcessingPrompt,
    sendChatMessage,
    loadModel,
    model: loadedModel,
  } = useLLMStore();
  const { getModelById } = useModelStore();
  const {
    addChat,
    updateLastUsed,
    setChatModel,
    phantomChat,
    setPhantomChatSettings,
  } = useChatStore();

  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { settings: chatSettings, setSetting } = useChatSettings(chatId);

  const enabledSources =
    chat?.enabledSources || phantomChat?.enabledSources || [];

  const { height: screenHeight } = useWindowDimensions();

  // Shared values for KeyboardChatScrollView
  const extraContentPadding = useSharedValue(0);
  const blankSpace = useSharedValue(0);
  const contentHeightAtReservation = useRef(0);
  const reservedSpace = useRef(0);

  // Reserve blank space when user sends a message (isProcessingPrompt = true)
  useEffect(() => {
    if (isProcessingPrompt) {
      reservedSpace.current = screenHeight * 0.5;
      blankSpace.value = reservedSpace.current;
    }
  }, [isProcessingPrompt, screenHeight, blankSpace]);

  // Shrink blank space as AI response streams in
  const handleContentSizeChange = useCallback(
    (_w: number, h: number) => {
      if (reservedSpace.current > 0) {
        // On first call after reservation, capture baseline height
        if (contentHeightAtReservation.current === 0) {
          contentHeightAtReservation.current = h;
          return;
        }
        // Shrink by how much content has grown since reservation
        const growth = h - contentHeightAtReservation.current;
        blankSpace.value = Math.max(0, reservedSpace.current - growth);

        // Once fully consumed, clean up
        if (growth >= reservedSpace.current) {
          reservedSpace.current = 0;
          contentHeightAtReservation.current = 0;
          blankSpace.value = 0;
        }
      }
    },
    [blankSpace]
  );

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
    const settings: ChatSettings = {
      systemPrompt: chatSettings.systemPrompt,
      contextWindow: parseInt(chatSettings.contextWindow),
      thinkingEnabled: chatSettings.thinkingEnabled,
    };

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

  const handleThinkingToggle = async () => {
    if (!model?.thinking) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Thinking cannot be enabled for this model.',
      });
      return;
    }

    const newSettings: ChatSettings = {
      systemPrompt: chatSettings?.systemPrompt || '',
      contextWindow: chatSettings?.contextWindow
        ? parseInt(chatSettings.contextWindow)
        : 6,
      thinkingEnabled: !chatSettings?.thinkingEnabled,
    };

    setSetting('thinkingEnabled', !chatSettings?.thinkingEnabled);

    try {
      if (phantomChat?.id === chatId) {
        await setPhantomChatSettings(newSettings);
      } else {
        await setChatSettings(db, chatId, newSettings);
      }
    } catch (error) {
      setSetting('thinkingEnabled', !chatSettings?.thinkingEnabled);
      console.error('Failed to update thinking setting:', error);
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
    <View style={styles.container} collapsable={false}>
      <Messages
        chatHistory={messageHistory}
        extraContentPadding={extraContentPadding}
        blankSpace={blankSpace}
        onContentSizeChange={handleContentSizeChange}
      />

      <KeyboardStickyView>
        <ChatBar
          chatId={chatId}
          onSend={handleSendMessage}
          onSelectModel={handlePresentModelSheet}
          onSelectSource={handlePresentSourceSheet}
          onSelectPrompt={handleSelectPrompt}
          ref={inputRef}
          model={model}
          extraContentPadding={extraContentPadding}
          activeSourcesCount={enabledSources.length}
          thinkingEnabled={chatSettings?.thinkingEnabled || false}
          onThinkingToggle={handleThinkingToggle}
          hasMessages={messageHistory.length > 0}
        />
      </KeyboardStickyView>

      <ModelSelectSheet
        bottomSheetModalRef={modelBottomSheetModalRef}
        selectModel={handleSelectModel}
      />
      <SourceSelectSheet
        bottomSheetModalRef={sourceBottomSheetModalRef}
        enabledSources={enabledSources}
        chatId={chatId}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
  });
