import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useHeaderHeight } from '@react-navigation/elements';
import { useKeyboardLift } from './useKeyboardLift';
import { useModelSwitch } from './useModelSwitch';
import { useSendChatMessage } from './useSendChatMessage';
import { useChatScreenLayout } from './useChatScreenLayout';
import { useChatScreenActions } from './useChatScreenActions';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import type { MessagesHandle } from './Messages';
import { useLLMStore } from '../../store/llmStore';
import { useChatStore } from '../../store/chatStore';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Chat, type Message } from '../../database/chatRepository';
import { Model } from '../../database/modelRepository';
import Messages from './Messages';
import ChatBar from './ChatBar';
import { TopFade } from './TopFade';
import UserMessageActionMenu from './UserMessageActionMenu';
import ModelSelectSheet from '../bottomSheets/ModelSelectSheet';
import { Theme } from '../../styles/colors';
import { useSQLiteContext } from 'expo-sqlite';
import { useVectorStore } from '../../context/VectorStoreContext';
import { WEB_SEARCH_ENABLED } from '../../constants/web';
import { useLegacyChatNotice } from '../../hooks/useLegacyChatNotice';
import useChatSettings from '../../hooks/useChatSettings';
import { setLastUsedModelId } from '../../utils/lastUsedModel';
import useChatBranching from '../../hooks/useChatBranching';
import { LAYOUT_HEIGHT_CHANGE_THRESHOLD } from '../../constants/chat-screen';

interface Props {
  chatId: number;
  chat: Chat | undefined;
  messageHistory: Message[];
  isLoading?: boolean;
  model: Model | undefined;
  onPendingModelChange?: (model: Model | undefined) => void;
  selectModel?: (model: Model) => Promise<void>;
  openModelSheetRef?: React.MutableRefObject<(() => void) | null>;
  revealFromTop?: boolean;
  headerTitleBottom?: number;
}

export default function ChatScreen({
  chatId,
  chat,
  messageHistory,
  isLoading = false,
  model,
  onPendingModelChange,
  selectModel,
  openModelSheetRef,
  revealFromTop = false,
  headerTitleBottom,
}: Props) {
  const inputRef = useRef<{
    setInput: (text: string) => void;
  }>(null);
  const messagesRef = useRef<MessagesHandle>(null);
  const modelBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const db = useSQLiteContext();

  const { vectorStore, embeddings } = useVectorStore();
  const {
    isLoading: isModelLoading,
    isGenerating,
    loadModel,
    generationError,
    retryLastGeneration,
  } = useLLMStore();
  const { setChatModel, phantomChat } = useChatStore();

  const { styles, theme } = useThemedStyles(createStyles);
  const headerHeight = useHeaderHeight();

  const keyboardLift = useKeyboardLift();
  const chatBarStickyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboardLift.value }],
  }));

  const { settings: chatSettings, setSetting } = useChatSettings(chatId);

  const enabledSources =
    chat?.enabledSources || phantomChat?.enabledSources || [];

  // Shared values for KeyboardChatScrollView
  const extraContentPadding = useSharedValue(0);
  const blankSpace = useSharedValue(0);
  const [chatBarHeight, setChatBarHeight] = useState(0);

  useEffect(() => {
    extraContentPadding.set(0);
    blankSpace.set(0);
  }, [model?.id, extraContentPadding, blankSpace]);

  const isEmpty = !isLoading && messageHistory.length === 0;
  const hasMessages = isLoading || messageHistory.length > 0;

  const {
    rootRef,
    handleRootLayout,
    userActionMenu,
    setUserActionMenu,
    userActionMenuPosition,
    gradientStyle,
    showGradient,
    fadeBottom,
    topFadeAnchor,
    emptyFadeColors,
  } = useChatScreenLayout({ isEmpty, headerTitleBottom, headerHeight, theme });

  const { branchMarkers, handleForkMessage, handleBranchMarkerPress } =
    useChatBranching({
      chatId,
      messageHistoryLength: messageHistory.length,
    });
  const handleBarGrow = useCallback(() => {
    setTimeout(() => {
      messagesRef.current?.scrollToEndIfAtBottom();
    }, 100);
  }, []);

  // Freeze the scroll view's layout whenever any overlay (model picker,
  // attachment sheet) is presented so keyboard dismiss → sheet open doesn't
  // cause an intermediate content jump.
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [attachmentSheetOpen, setAttachmentSheetOpen] = useState(false);
  const overlayOpen = modelSheetOpen || attachmentSheetOpen;

  useEffect(() => {
    setModelSheetOpen(false);
    setAttachmentSheetOpen(false);
  }, [model?.id]);

  const handlePresentModelSheet = useCallback(() => {
    Keyboard.dismiss();
    setUserActionMenu({ isOpen: false });
    modelBottomSheetModalRef.current?.present();
  }, [setUserActionMenu]);

  const handleChatBarHeightChange = useCallback((height: number) => {
    setChatBarHeight((current) =>
      Math.abs(current - height) > LAYOUT_HEIGHT_CHANGE_THRESHOLD
        ? height
        : current
    );
  }, []);

  useEffect(() => {
    if (!openModelSheetRef) return;
    openModelSheetRef.current = handlePresentModelSheet;
    return () => {
      openModelSheetRef.current = null;
    };
  }, [openModelSheetRef, handlePresentModelSheet]);

  const handleSelectModel = async (selectedModel: Model) => {
    try {
      await loadModel(selectedModel);
      if (useLLMStore.getState().model?.id !== selectedModel.id) {
        throw new Error(`Model ${selectedModel.id} did not finish loading`);
      }

      if (chatId && !model) {
        await setChatModel(chatId, selectedModel.id);
      }

      await setLastUsedModelId(selectedModel.id);
      await selectModel?.(selectedModel);
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

  const {
    pendingModel,
    isSwitching,
    pickModel,
    handleSheetStateChange: handleModelSwitchSheetState,
  } = useModelSwitch(handleSelectModel);

  useEffect(() => {
    onPendingModelChange?.(pendingModel);
  }, [pendingModel, onPendingModelChange]);

  const handleModelSheetStateChange = useCallback(
    (isOpen: boolean) => {
      setModelSheetOpen(isOpen);
      handleModelSwitchSheetState(isOpen);
    },
    [handleModelSwitchSheetState]
  );

  const handleSendMessage = useSendChatMessage({
    chatId,
    model,
    messageHistory,
    chatSettings,
    enabledSources,
    vectorStore,
    embeddings,
    messagesRef,
    db,
    isGenerating,
    isModelLoading,
    isSwitching,
  });

  const { handleThinkingToggle, handleWebSearchToggle, handleSelectPrompt } =
    useChatScreenActions({
      chatId,
      chat,
      model,
      chatSettings,
      setSetting,
      db,
      inputRef,
    });

  const chatGenerationError =
    generationError?.chatId === chatId ? generationError.message : undefined;

  const handleRetryGeneration = useCallback(() => {
    messagesRef.current?.onMessageSent();
    retryLastGeneration().catch((error) => {
      console.error('Failed to retry generation:', error);
    });
  }, [retryLastGeneration]);

  const scrollBottomOffset = theme.insets.bottom;

  useLegacyChatNotice(messageHistory);

  return (
    <View
      ref={rootRef}
      style={styles.container}
      collapsable={false}
      onLayout={handleRootLayout}
    >
      {showGradient && (
        <Animated.View
          style={[StyleSheet.absoluteFill, gradientStyle]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[theme.bg.softPrimary, theme.bg.main]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      <View style={styles.messagesLayer} pointerEvents="box-none">
        <Messages
          ref={messagesRef}
          chatHistory={messageHistory}
          extraContentPadding={extraContentPadding}
          blankSpace={blankSpace}
          isGenerating={isGenerating}
          generationError={chatGenerationError}
          onRetryGeneration={handleRetryGeneration}
          bottomOffset={scrollBottomOffset}
          freeze={overlayOpen}
          revealFromTop={revealFromTop}
          branchMarkers={branchMarkers}
          onForkMessage={handleForkMessage}
          onBranchMarkerPress={handleBranchMarkerPress}
          onUserActionMenuChange={setUserActionMenu}
          chatBarInset={chatBarHeight}
          topInset={headerHeight}
          fadeBottom={fadeBottom}
        />
      </View>

      <Animated.View style={[styles.chatBarSticky, chatBarStickyStyle]}>
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
          webSearchEnabled={chatSettings?.webSearchEnabled || false}
          onWebSearchToggle={
            WEB_SEARCH_ENABLED ? handleWebSearchToggle : undefined
          }
          hasMessages={hasMessages}
          disabled={isModelLoading && !isSwitching}
          modelSwitching={isSwitching}
          onAttachmentSheetStateChange={setAttachmentSheetOpen}
          onHeightChange={handleChatBarHeightChange}
          onBarGrow={handleBarGrow}
        />
      </Animated.View>

      {isEmpty && (
        <TopFade
          anchor={topFadeAnchor}
          colors={emptyFadeColors}
          style={styles.topFadeOverlay}
        />
      )}

      {userActionMenuPosition && (
        <View
          style={[styles.userActionMenuOverlay, userActionMenuPosition]}
          pointerEvents="box-none"
        >
          <UserMessageActionMenu onCopy={userActionMenu.onCopy} />
        </View>
      )}

      <ModelSelectSheet
        bottomSheetModalRef={modelBottomSheetModalRef}
        onModelPicked={pickModel}
        onSheetStateChange={handleModelSheetStateChange}
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
    messagesLayer: {
      flex: 1,
      zIndex: 1,
      elevation: 1,
      overflow: 'visible',
    },
    userActionMenuOverlay: {
      position: 'absolute',
      zIndex: 1000,
      elevation: 1000,
    },
    topFadeOverlay: {
      zIndex: 3,
      elevation: 3,
    },
    chatBarSticky: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 2,
      elevation: 2,
    },
  });
