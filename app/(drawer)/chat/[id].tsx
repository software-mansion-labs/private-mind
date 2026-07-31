import React, { useCallback, useRef } from 'react';
import {
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from 'expo-router';
import { BackHandler } from 'react-native';
import ChatScreen from '../../../components/chat-screen/ChatScreen';
import { useState } from 'react';
import { useLLMStore } from '../../../store/llmStore';
import { useModelStore } from '../../../store/modelStore';
import { Model } from '../../../database/modelRepository';
import { useChatStore } from '../../../store/chatStore';
import useChatHeader from '../../../hooks/useChatHeader';
import {
  CHAT_ENTRY_ANIMATION,
  ChatEntryAnimation,
} from '../../../constants/chat-route-params';

export default function ChatScreenWrapper() {
  const { id, modelId } = useLocalSearchParams<{
    id: string;
    modelId?: string;
  }>();

  const key = `${id}-${modelId || 'default'}`;

  return <ChatScreenInner key={key} />;
}

function ChatScreenInner() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const {
    modelId,
    entryAnimation,
  }: { modelId: string; entryAnimation?: ChatEntryAnimation } =
    useLocalSearchParams();
  const navigation = useNavigation();
  const { activeChatMessages, activeChatId } = useLLMStore();
  const { getModelById } = useModelStore();
  const { getChatById, setChatModel, loadChats, phantomChat } = useChatStore();
  const chatId = parseInt(rawId, 10);
  const chat = getChatById(chatId);
  const isPhantom = phantomChat?.id === chatId && !chat;
  const shouldPlayBranchEntryAnimation =
    entryAnimation === CHAT_ENTRY_ANIMATION.BranchCreated;
  const resolvedModelId = modelId ?? chat?.modelId;
  const resolvedModel = resolvedModelId
    ? getModelById(parseInt(resolvedModelId.toString(), 10))
    : undefined;
  const [model, setModel] = useState<Model | undefined>(resolvedModel);
  // Only show the loading/empty state on the very first mount for this
  // chat. useFocusEffect refires on every refocus (including returning
  // from a bottom sheet), and flipping messageHistory to [] mid-session
  // causes Messages.tsx to reset its reveal animation, briefly blanking
  // the chat. If the store already has this chat active, skip the
  // reset and use the existing data. Phantom chats have no history, so
  // skip loading entirely.
  const [isLoading, setIsLoading] = useState(
    !isPhantom && activeChatId !== chatId
  );

  const isEmpty = !isLoading && activeChatMessages.length === 0;
  const shouldExitOnBack = isPhantom && isEmpty;
  const openModelSheetRef = useRef<(() => void) | null>(null);
  const openModelSheet = useCallback(() => openModelSheetRef.current?.(), []);

  const { MenuElements, titleBottom } = useChatHeader({
    chatId: chatId,
    chatModel: model,
    isEmpty,
    onSelectModelFromTitle: isPhantom ? openModelSheet : undefined,
  });

  useFocusEffect(
    useCallback(() => {
      // Interrupt generation only when the user actually left this chat.
      // Sending the first message replaces the phantom route with the real
      // chat route of the same id, which remounts this screen — the blur
      // cleanup of the old instance must not kill the in-flight generation.
      const interruptIfLeftChat = () => {
        const snapshot = useLLMStore.getState();
        const isGeneratingThisChat =
          snapshot.generatingForChatId === chatId &&
          (snapshot.isGenerating || snapshot.isProcessingPrompt);
        if (!isGeneratingThisChat) return;

        const navState = navigation.getState();
        const focusedRoute = navState?.routes?.[navState.index ?? 0];
        const stillOnThisChat =
          focusedRoute?.name === 'chat/[id]' &&
          Number((focusedRoute.params as { id?: string })?.id) === chatId;

        if (!stillOnThisChat) {
          snapshot.interrupt();
        }
      };

      // Read activeChatId via store to avoid re-firing this effect when the
      // store's activeChatId changes while the screen is focused — otherwise
      // clearing activeChatId (e.g. from startPhantomChat during navigation)
      // would retrigger an unwanted re-fetch on the previously-focused chat.
      const currentActiveId = useLLMStore.getState().activeChatId;
      if (currentActiveId === chatId) {
        return interruptIfLeftChat;
      }
      const initChat = async () => {
        if (!isPhantom) setIsLoading(true);
        await useLLMStore.getState().setActiveChatId(chatId);
        setIsLoading(false);
      };

      initChat();

      return interruptIfLeftChat;
    }, [chatId, isPhantom, navigation])
  );

  useFocusEffect(
    useCallback(() => {
      if (!shouldExitOnBack) return;

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          BackHandler.exitApp();
          return true;
        }
      );

      return () => backHandler.remove();
    }, [shouldExitOnBack])
  );

  const handleSetModel = async (newModel: Model) => {
    setChatModel(chatId, newModel.id);
    loadChats();
    setModel(newModel);
  };

  return (
    <>
      <ChatScreen
        chatId={chatId}
        chat={chat}
        messageHistory={isLoading ? [] : activeChatMessages}
        isLoading={isLoading}
        model={model}
        selectModel={handleSetModel}
        openModelSheetRef={openModelSheetRef}
        revealFromTop={shouldPlayBranchEntryAnimation}
        headerTitleBottom={titleBottom}
      />
      {MenuElements}
    </>
  );
}
