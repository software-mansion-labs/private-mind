import React, { RefObject, useMemo, useRef } from 'react';
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
import { setChatSettings } from '../../../database/chatRepository';
import { useSQLiteContext } from 'expo-sqlite';
import PrimaryButton from '../../../components/PrimaryButton';
import { useTheme } from '../../../context/ThemeContext';
import { useModelStore } from '../../../store/modelStore';
import { useChatStore } from '../../../store/chatStore';
import ModalHeader from '../../../components/ModalHeader';
import Toast from 'react-native-toast-message';
import { exportChatRoom } from '../../../database/exportImportRepository';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../../styles/colors';
import useChatSettings from '../../../hooks/useChatSettings';
import ChatSettingsForm from '../../../components/settings/ChatSettingsForm';

export default function ChatSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = Number(id) || null;

  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { theme } = useTheme();
  const { getModelById } = useModelStore();
  const { renameChat, deleteChat } = useChatStore();

  const { settings, setSetting, chat } = useChatSettings(chatId);
  const isDefaultSettings = chat === undefined;

  const model = chat?.modelId ? getModelById(chat?.modelId) : undefined;

  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleSave = async () => {
    const newSettings = {
      systemPrompt: settings.systemPrompt,
      contextWindow: Number(settings.contextWindow) || 6,
    };

    await setChatSettings(db, chatId, newSettings);

    if (chatId !== null) {
      const newChatTitle =
        settings.title.length > 25
          ? settings.title.slice(0, 25) + '...'
          : settings.title;
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

  const handleExport = async () => {
    if (!chatId) {
      Alert.alert('Error', 'No chat to export.');
      return;
    }

    await exportChatRoom(db, chatId, settings.title);
  };

  const handleAppInfo = () => {
    router.push('/modal/app-info');
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 + insets.bottom : 0}
    >
      <View style={styles.container}>
        <ModalHeader title="Chat Settings" onClose={() => router.back()} />
        <ChatSettingsForm
          settings={settings}
          setSetting={setSetting}
          model={model}
          isDefaultSettings={isDefaultSettings}
          scrollViewRef={scrollViewRef as RefObject<ScrollView>}
          onDelete={handleDelete}
          onExport={handleExport}
          onAppInfo={handleAppInfo}
        />
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
  });
