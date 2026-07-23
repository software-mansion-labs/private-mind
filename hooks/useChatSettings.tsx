import { useState, useEffect, useMemo } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useChatStore } from '../store/chatStore';
import { useWebSearchStore } from '../store/webSearchStore';
import { Chat, getChatSettings } from '../database/chatRepository';

interface ChatSettingsState {
  title: string;
  systemPrompt: string;
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;
}

type LocalSettingsState = Omit<ChatSettingsState, 'webSearchEnabled'>;

export default function useChatSettings(chatId: number | null) {
  const db = useSQLiteContext();
  const { getChatById, phantomChat } = useChatStore();

  const webSearchEnabled = useWebSearchStore((state) =>
    state.isEnabled(chatId)
  );
  const setWebSearchEnabled = useWebSearchStore((state) => state.setEnabled);

  const chat: Chat | undefined = useMemo(() => {
    const storedChat = getChatById(chatId as number);
    return storedChat?.id === chatId ? storedChat : undefined;
  }, [chatId, getChatById]);
  const isPhantomChat = chatId === phantomChat?.id && !chat;
  const currentChat = isPhantomChat ? phantomChat : chat;

  const [settings, setSettings] = useState<LocalSettingsState>({
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
    if (key === 'webSearchEnabled') {
      setWebSearchEnabled(chatId, value as boolean);
      return;
    }
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const mergedSettings = useMemo(
    () => ({ ...settings, webSearchEnabled }),
    [settings, webSearchEnabled]
  );

  return { settings: mergedSettings, setSetting, chat: currentChat };
}
