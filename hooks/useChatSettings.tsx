import { useState, useEffect, useMemo } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useChatStore } from '../store/chatStore';
import { Chat, getChatSettings } from '../database/chatRepository';

interface ChatSettingsState {
  title: string;
  systemPrompt: string;
  contextWindow: string;
}

export default function useChatSettings(chatId: number | null) {
  const db = useSQLiteContext();
  const { getChatById, phantomChat } = useChatStore();

  // Determine which chat we're working with
  const isPhantomChat = chatId === phantomChat?.id;
  const chat: Chat | undefined = isPhantomChat
    ? phantomChat
    : useMemo(() => getChatById(chatId as number), [chatId, getChatById]);

  const [settings, setSettings] = useState<ChatSettingsState>({
    title: chat?.title || '',
    systemPrompt: '',
    contextWindow: '6',
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (isPhantomChat && phantomChat?.settings) {
          // Phantom chat: use settings from phantom chat store
          if (isMounted) {
            setSettings((prev) => ({
              ...prev,
              systemPrompt: phantomChat.settings!.systemPrompt,
              contextWindow: String(phantomChat.settings!.contextWindow),
            }));
          }
        } else {
          // Default settings or existing chat: use getChatSettings
          const dbSettings = await getChatSettings(db, chatId);
          if (isMounted) {
            setSettings((prev) => ({
              ...prev,
              systemPrompt: dbSettings.systemPrompt,
              contextWindow: String(dbSettings.contextWindow),
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

  const setSetting = (key: keyof ChatSettingsState, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return { settings, setSetting, chat };
}
