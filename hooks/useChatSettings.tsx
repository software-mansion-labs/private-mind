import { useState, useEffect, useMemo } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useChatStore } from '../store/chatStore';
import { Chat, getChatSettings } from '../database/chatRepository';

interface ChatSettingsState {
  title: string;
  systemPrompt: string;
  thinkingEnabled: boolean;
}

export default function useChatSettings(chatId: number | null) {
  const db = useSQLiteContext();
  const { getChatById, phantomChat } = useChatStore();

  const isPhantomChat = chatId === phantomChat?.id;
  const chat: Chat | undefined = useMemo(() => {
    return isPhantomChat ? phantomChat : getChatById(chatId as number);
  }, [isPhantomChat, phantomChat, chatId, getChatById]);

  const [settings, setSettings] = useState<ChatSettingsState>({
    title: chat?.title || '',
    systemPrompt: '',
    thinkingEnabled: false,
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (isPhantomChat && phantomChat?.settings) {
          if (isMounted) {
            setSettings((prev) => ({
              ...prev,
              systemPrompt: phantomChat.settings!.systemPrompt,
              thinkingEnabled: phantomChat.settings!.thinkingEnabled ?? false,
            }));
          }
        } else {
          const dbSettings = await getChatSettings(db, chatId);
          if (isMounted) {
            setSettings((prev) => ({
              ...prev,
              systemPrompt: dbSettings.systemPrompt,
              thinkingEnabled: dbSettings.thinkingEnabled ?? false,
            }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch chat settings:', error);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [db, chatId, phantomChat?.settings]);

  const setSetting = (
    key: keyof ChatSettingsState,
    value: string | boolean
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return { settings, setSetting, chat };
}
