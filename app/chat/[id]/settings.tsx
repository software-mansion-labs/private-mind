import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Text,
  StyleSheet,
  ScrollView,
  View,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getChatSettings,
  setChatSettings,
} from '../../../database/chatRepository';
import { useSQLiteContext } from 'expo-sqlite';
import PrimaryButton from '../../../components/PrimaryButton';
import { useTheme } from '../../../context/ThemeContext';
import { useModelStore } from '../../../store/modelStore';
import ModelCard from '../../../components/model-hub/ModelCard';
import { useChatStore } from '../../../store/chatStore';
import TextFieldInput from '../../../components/TextFieldInput';
import { fontFamily, fontSizes } from '../../../styles/fontFamily';
import TextAreaField from '../../../components/TextAreaField';
import ModalHeader from '../../../components/ModalHeader';
import Toast from 'react-native-toast-message';
import SecondaryButton from '../../../components/SecondaryButton';
import { exportChatRoom } from '../../../database/exportImportRepository';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../../styles/colors';

export default function ChatSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = Number(id) || null;
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const db = useSQLiteContext();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { getModelById } = useModelStore();
  const { getChatById, renameChat, deleteChat } = useChatStore();

  const chat = getChatById(chatId as number);
  const model = chat?.modelId ? getModelById(chat?.modelId) : undefined;

  const [chatTitle, setChatTitle] = useState(
    chat ? chat.title : `Chat #${chatId}`
  );
  const [systemPrompt, setSystemPrompt] = useState('');
  const [contextWindow, setContextWindow] = useState('6');

  useEffect(() => {
    (async () => {
      const settings = await getChatSettings(db, chatId);
      setSystemPrompt(settings.systemPrompt);
      setContextWindow(String(settings.contextWindow) || '6');
    })();
  }, [db, chatId]);

  const handleSave = async () => {
    const newSettings = {
      systemPrompt,
      contextWindow: Number(contextWindow) || 6,
    };

    if (chatId === null) {
      await AsyncStorage.setItem(
        'default_chat_settings',
        JSON.stringify(newSettings)
      );
    } else {
      await setChatSettings(db, chatId, newSettings);
      const newChatTitle =
        chatTitle.length > 25 ? chatTitle.slice(0, 25) + '...' : chatTitle;
      await renameChat(chatId, newChatTitle);
    }

    router.back();
    Toast.show({
      type: 'defaultToast',
      text1: 'Chat settings has been succesfully updated',
    });
  };

  const handleDelete = async () => {
    Alert.alert('Delete Chat', 'Are you sure you want to delete this chat?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteChat(chatId!);
            router.replace('/');
          } catch (error) {
            console.error('Error deleting chat:', error);
            Alert.alert('Error', 'Failed to delete chat. Please try again.');
          }
        },
      },
    ]);
  };

  const scrollToInput = async () => {
    if (Platform.OS === 'ios') {
      await new Promise((resolve) => setTimeout(resolve, 25));
      scrollViewRef.current?.scrollTo({ y: 500, animated: true });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 + insets.bottom : 0}
    >
      <View style={styles.container}>
        <ModalHeader title="Chat Settings" onClose={() => router.back()} />
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          ref={scrollViewRef}
        >
          {chatId !== null && (
            <View style={styles.textFieldSection}>
              <Text style={styles.label}>Chat name</Text>
              <TextFieldInput
                value={chatTitle}
                maxLength={25}
                onChangeText={(val) => {
                  setChatTitle(val);
                }}
              />
            </View>
          )}

          {model && (
            <View style={styles.textFieldSection}>
              <Text style={styles.label}>Model in use</Text>
              <Text style={styles.subLabel}>
                Model selected during the creation of the chatroom. It cannot be
                changed.
              </Text>
              <ModelCard model={model!} onPress={() => {}} />
            </View>
          )}

          <View style={styles.textFieldSection}>
            <Text style={styles.label}>Context Window</Text>
            <Text style={styles.subLabel}>
              Number of previously entered messages the model will have access
              to.
            </Text>
            <TextFieldInput
              value={contextWindow}
              onChangeText={(val) => setContextWindow(val)}
              placeholder="ex. 6"
            />
          </View>

          <View style={styles.textFieldSection}>
            <Text style={styles.label}>System Prompt</Text>
            <Text style={styles.subLabel}>
              Instruction defining the behavior of the model.
            </Text>
            <TextAreaField
              value={systemPrompt}
              onChangeText={setSystemPrompt}
              placeholder="ex. Act as a IT support consultant and reply using only 1 sentence."
              placeholderTextColor={theme.text.defaultTertiary}
              onFocus={() => scrollToInput()}
            />
          </View>
          {chatId && (
            <View style={styles.buttonSection}>
              <SecondaryButton
                text={'Export Chat'}
                onPress={async () => {
                  await exportChatRoom(db, chatId, chatTitle);
                }}
              />
              <SecondaryButton
                text={'Delete Chat'}
                style={{ borderColor: theme.bg.errorPrimary }}
                textStyle={{ color: theme.text.error }}
                onPress={handleDelete}
              />
            </View>
          )}
        </ScrollView>
        <PrimaryButton text="Save changes" onPress={handleSave} />
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    keyboardAvoidingView: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    container: {
      flex: 1,
      padding: 16,
      justifyContent: 'space-between',
      paddingBottom: Platform.OS === 'ios' ? 24 : 0,
    },
    scrollViewContent: {
      gap: 24,
      paddingBottom: 24,
    },
    textFieldSection: {
      gap: 16,
    },
    buttonSection: {
      gap: 12,
    },
    label: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    subLabel: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultSecondary,
    },
  });
