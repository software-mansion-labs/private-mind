import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSharedValue } from 'react-native-reanimated';
import type { MessagesHandle } from './Messages';
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
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { Attachment } from '../../hooks/useAttachment';
import { filterAndFormatContext, formatFirstChunks } from '../../utils/contextUtils';
import { useSourceStore } from '../../store/sourceStore';
import useChatSettings from '../../hooks/useChatSettings';
import Toast from 'react-native-toast-message';
import { persistImage } from '../../utils/persistImage';

interface Props {
  chatId: number;
  chat: Chat | undefined;
  messageHistory: Message[];
  isLoading?: boolean;
  model: Model | undefined;
  selectModel?: (model: Model) => Promise<void>;
}

const prepareContext = async (
  prompt: string,
  enabledSources: number[],
  vectorStore: OPSQLiteVectorStore
) => {
  try {
    const context = await vectorStore.query({
      queryText: prompt,
      predicate: (r) => enabledSources.includes(r.metadata?.documentId),
    });
    return filterAndFormatContext(context);
  } catch (error) {
    console.error('Error preparing context:', error);
    return [];
  }
};

export default function ChatScreen({
  chatId,
  chat,
  messageHistory,
  isLoading = false,
  model,
  selectModel,
}: Props) {
  const inputRef = useRef<{
    clear: () => void;
    setInput: (text: string) => void;
  }>(null);
  const messagesRef = useRef<MessagesHandle>(null);
  const modelBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const db = useSQLiteContext();

  const { vectorStore } = useVectorStore();
  const {
    isGenerating,
    sendChatMessage,
    loadModel,
    model: loadedModel,
  } = useLLMStore();
  const { getModelById } = useModelStore();
  const {
    addChat,
    updateLastUsed,
    setChatModel,
    enableSource,
    phantomChat,
    setPhantomChatSettings,
  } = useChatStore();

  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const stickyOffset = useMemo(
    () => ({ closed: 0, opened: theme.insets.bottom }),
    [theme.insets.bottom]
  );
  const scrollBottomOffset = theme.insets.bottom;

  const { settings: chatSettings, setSetting } = useChatSettings(chatId);

  const enabledSources =
    chat?.enabledSources || phantomChat?.enabledSources || [];

  // Shared values for KeyboardChatScrollView
  const extraContentPadding = useSharedValue(0);
  const blankSpace = useSharedValue(0);
  const [chatBarSpacerHeight, setChatBarSpacerHeight] = useState(0);

  // Freeze the scroll view's layout whenever any overlay (model picker,
  // attachment sheet) is presented so keyboard dismiss → sheet open doesn't
  // cause an intermediate content jump.
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [attachmentSheetOpen, setAttachmentSheetOpen] = useState(false);
  const overlayOpen = modelSheetOpen || attachmentSheetOpen;

  const handlePresentModelSheet = useCallback(() => {
    Keyboard.dismiss();
    modelBottomSheetModalRef.current?.present();
  }, []);

  const handleSendMessage = async (
    userInput: string,
    imagePath?: string,
    attachments?: Attachment[]
  ) => {
    const hasDocuments = attachments?.some((a) => a.type === 'document');
    if (
      (!userInput.trim() && !imagePath && !hasDocuments) ||
      isGenerating
    )
      return;
    if (!(await checkIfChatExists(db, chatId!))) {
      const docName = attachments?.find((a) => a.type === 'document')?.name;
      const titleSource = userInput.trim() || docName || 'New chat';
      const newChatTitle =
        titleSource.length > 25
          ? titleSource.slice(0, 25) + '...'
          : titleSource;
      await addChat(newChatTitle, model!.id);
    }

    let persistedImagePath: string | undefined = imagePath;
    if (imagePath) {
      try {
        persistedImagePath = await persistImage(imagePath);
      } catch (error) {
        console.error('Failed to persist image attachment:', error);
        Toast.show({
          type: 'defaultToast',
          text1: 'Failed to save image attachment.',
        });
        return;
      }
    }

    inputRef.current?.clear();
    Keyboard.dismiss();
    updateLastUsed(chatId!);

    // Notify Messages that a send is in flight. It will seed blankSpace to
    // the full container height, then derive the final value from measured
    // heights as the new user row and assistant placeholder lay out. See
    // the v0 iOS app technique:
    // https://vercel.com/blog/how-we-built-the-v0-ios-app
    messagesRef.current?.onMessageSent();

    // Build context from attachments + persisted sources
    const context: string[] = [];

    // Collect all source IDs: from attachments + already enabled on chat
    const attachmentSourceIds = (attachments || [])
      .filter((a) => a.type === 'document' && a.sourceId)
      .map((a) => a.sourceId!);
    const allSourceIds = [
      ...new Set([...enabledSources, ...attachmentSourceIds]),
    ];

    // RAG context from all sources (persisted + newly attached)
    if (allSourceIds.length > 0 && vectorStore) {
      const allSources = useSourceStore.getState().sources;
      const activeSources = allSources.filter((s) =>
        allSourceIds.includes(s.id)
      );
      const firstChunkContext = formatFirstChunks(activeSources);
      context.push(...firstChunkContext);

      if (userInput.trim()) {
        const ragContext = await prepareContext(
          userInput,
          allSourceIds,
          vectorStore
        );
        context.push(...ragContext);
      }
    }

    // Enable new sources for this chat (persists for future messages)
    for (const sourceId of attachmentSourceIds) {
      if (!enabledSources.includes(sourceId)) {
        await enableSource(chatId!, sourceId);
      }
    }

    const settings: ChatSettings = {
      systemPrompt: chatSettings.systemPrompt,
      thinkingEnabled: chatSettings.thinkingEnabled,
    };

    const docAttachments = attachments?.filter((a) => a.type === 'document') || [];
    const docName = docAttachments.map((a) => a.name).filter(Boolean).join(', ') || undefined;
    await sendChatMessage(
      userInput, chatId!, context, settings, persistedImagePath,
      docName
    );
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
        ref={messagesRef}
        chatHistory={messageHistory}
        extraContentPadding={extraContentPadding}
        blankSpace={blankSpace}
        isGenerating={isGenerating}
        bottomOffset={scrollBottomOffset}
        freeze={overlayOpen}
      />

      <View
        style={[
          styles.chatBarSpacer,
          chatBarSpacerHeight > 0 && { height: chatBarSpacerHeight },
        ]}
      >
        <KeyboardStickyView offset={stickyOffset} style={styles.chatBarSticky}>
          <ChatBar
            chatId={chatId}
            onSend={handleSendMessage}
            onSelectModel={handlePresentModelSheet}
            onSelectPrompt={handleSelectPrompt}
            ref={inputRef}
            model={model}
            isVisionModel={model?.vision === true}
            extraContentPadding={extraContentPadding}
            thinkingEnabled={chatSettings?.thinkingEnabled || false}
            onThinkingToggle={handleThinkingToggle}
            hasMessages={isLoading || messageHistory.length > 0}
            onAttachmentSheetStateChange={setAttachmentSheetOpen}
            onHeightChange={(h: number) => {
              if (chatBarSpacerHeight === 0) setChatBarSpacerHeight(h);
            }}
            onBarGrow={() => {
              setTimeout(() => {
                messagesRef.current?.scrollToEnd();
              }, 100);
            }}
          />
        </KeyboardStickyView>
      </View>

      <ModelSelectSheet
        bottomSheetModalRef={modelBottomSheetModalRef}
        selectModel={handleSelectModel}
        onSheetStateChange={setModelSheetOpen}
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
    chatBarSpacer: {
      overflow: 'visible',
    },
    chatBarSticky: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
    },
  });
