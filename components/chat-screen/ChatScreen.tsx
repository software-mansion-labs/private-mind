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
  Text,
  TouchableOpacity,
} from 'react-native';
import { useModelStore } from '../../store/modelStore';
import { useLLMStore } from '../../store/llmStore';
import { useChatStore } from '../../store/chatStore';
import { type Message } from '../../database/chatRepository';
import { Model } from '../../database/modelRepository';
import Messages from './Messages';
import { useTheme } from '../../context/ThemeContext';
import { router } from 'expo-router';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetFlatList,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import PrimaryButton from '../PrimaryButton';
import ChatBar from './ChatBar';
import ModelCard from '../model-hub/ModelCard';

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
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { theme } = useTheme();

  const { downloadedModels, loadModels } = useModelStore();
  const { db, isGenerating, loadModel, sendChatMessage } = useLLMStore();
  const { addChat, updateLastUsed, setChatModel } = useChatStore();

  const [userInput, setUserInput] = useState('');

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  useEffect(() => {
    loadModels();
  }, [chatId, db, loadModels]);

  const handleSelectModel = async (selectedModel: Model) => {
    try {
      await loadModel(selectedModel);
      if (chatIdRef.current && !model) {
        await setChatModel(chatIdRef.current, selectedModel.id);
      }
      selectModel?.(selectedModel);
      bottomSheetModalRef.current?.dismiss();
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

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.2}
      />
    ),
    []
  );

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 100}
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
            onSelectModel={handlePresentModalPress}
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
        />
      </KeyboardAvoidingView>

      <BottomSheetModal
        ref={bottomSheetModalRef}
        backdropComponent={renderBackdrop}
        snapPoints={['30%', '50%']}
        enableDynamicSizing={false}
        handleIndicatorStyle={{
          backgroundColor: theme.text.primary,
          ...styles.bottomSheetIndicator,
        }}
      >
        {downloadedModels.length > 0 ? (
          <View style={styles.bottomSheet}>
            <Text style={{ ...styles.title, color: theme.text.primary }}>
              Select a Model
            </Text>
            <BottomSheetFlatList
              data={downloadedModels}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ gap: 8, paddingBottom: 60 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleSelectModel(item)}>
                  <ModelCard model={item} />
                </TouchableOpacity>
              )}
            />
          </View>
        ) : (
          <BottomSheetView style={styles.bottomSheet}>
            <Text style={{ ...styles.title, color: theme.text.primary }}>
              You have no available models yet
            </Text>
            <Text
              style={{
                ...styles.bottomSheetSubText,
                color: theme.text.defaultSecondary,
              }}
            >
              To use Local Mind you need to have at least one model downloaded
            </Text>
            <PrimaryButton
              text="Open models list"
              onPress={() => {
                bottomSheetModalRef.current?.dismiss();
                router.push('/model-hub');
              }}
            />
          </BottomSheetView>
        )}
      </BottomSheetModal>
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
  contentContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSizes.fontSizeLg,
    fontFamily: fontFamily.medium,
  },
  modelItemText: {
    fontSize: 16,
  },
  bottomSheet: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 24,
  },
  bottomSheetSubText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.fontSizeMd,
  },
  bottomSheetIndicator: {
    width: 64,
    height: 4,
    borderRadius: 20,
  },
});
