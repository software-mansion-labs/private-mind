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

  const chat: Chat | undefined = useMemo(() => {
    const storedChat = getChatById(chatId as number);
    return storedChat?.id === chatId ? storedChat : undefined;
  }, [chatId, getChatById]);
  const isPhantomChat = chatId === phantomChat?.id && !chat;
  const currentChat = isPhantomChat ? phantomChat : chat;

  const [settings, setSettings] = useState<ChatSettingsState>({
    title: currentChat?.title || '',
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
  }, [db, chatId, isPhantomChat, phantomChat?.settings]);

  const setSetting = (
    key: keyof ChatSettingsState,
    value: string | boolean
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return { settings, setSetting, chat: currentChat };
}
