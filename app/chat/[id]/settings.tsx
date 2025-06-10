import React, { useEffect, useState } from 'react';
import {
  Text,
  StyleSheet,
  ScrollView,
  View,
  KeyboardAvoidingView,
  Platform,
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

export default function ChatSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = Number(id) || null;

  const db = useSQLiteContext();
  const { theme } = useTheme();
  const { getModelById } = useModelStore();
  const { getChatById, renameChat } = useChatStore();

  const chat = getChatById(chatId as number);
  const model = getModelById(chat?.model || '');

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
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <View style={styles.container}>
        <ModalHeader title="Chat Settings" onClose={() => router.back()} />
        <ScrollView contentContainerStyle={{ gap: 24 }}>
          {chatId !== null && (
            <View style={styles.textFieldSection}>
              <Text style={{ ...styles.label, color: theme.text.primary }}>
                Chat name
              </Text>
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
              <Text style={{ ...styles.label, color: theme.text.primary }}>
                Model in use
              </Text>
              <Text
                style={{
                  ...styles.subLabel,
                  color: theme.text.defaultSecondary,
                }}
              >
                Model selected during the creation of the chatroom. It cannot be
                changed.
              </Text>
              <ModelCard model={model!} />
            </View>
          )}

          <View style={styles.textFieldSection}>
            <Text style={{ ...styles.label, color: theme.text.primary }}>
              Context Window
            </Text>
            <Text
              style={{
                ...styles.subLabel,
                color: theme.text.defaultSecondary,
              }}
            >
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
            <Text style={{ ...styles.label, color: theme.text.primary }}>
              System Prompt
            </Text>
            <Text
              style={{
                ...styles.subLabel,
                color: theme.text.defaultSecondary,
              }}
            >
              Instruction defining the behavior of the model.
            </Text>
            <TextAreaField
              value={systemPrompt}
              onChangeText={setSystemPrompt}
              placeholder="ex. Act as a IT support consultant and reply using only 1 sentence."
              placeholderTextColor={theme.text.defaultTertiary}
            />
          </View>
        </ScrollView>
        <PrimaryButton text="Save changes" onPress={handleSave} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  textFieldSection: {
    gap: 16,
  },
  label: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.medium,
  },
  subLabel: { fontFamily: fontFamily.regular, fontSize: fontSizes.sm },
});
