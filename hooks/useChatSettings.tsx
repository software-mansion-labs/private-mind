import { useState, useEffect, useMemo } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useChatStore } from '../store/chatStore';
import { getChatSettings } from '../database/chatRepository';

interface ChatSettingsState {
  title: string;
  systemPrompt: string;
  contextWindow: string;
}

export function useChatSettings(chatId: number | null) {
  const db = useSQLiteContext();
  const { getChatById } = useChatStore();
  const chat = useMemo(
    () => getChatById(chatId as number),
    [chatId, getChatById]
  );

  const [settings, setSettings] = useState<ChatSettingsState>({
    title: chat?.title || '',
    systemPrompt: '',
    contextWindow: '6',
  });

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const dbSettings = await getChatSettings(db, chatId);
        if (isMounted) {
          setSettings((prev) => ({
            ...prev,
            systemPrompt: dbSettings.systemPrompt,
            contextWindow: String(dbSettings.contextWindow) || '6',
          }));
        }
      } catch (error) {
        console.error('Failed to fetch chat settings:', error);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [db, chatId]);

  const setSetting = (key: keyof ChatSettingsState, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return { settings, setSetting, chat };
}
