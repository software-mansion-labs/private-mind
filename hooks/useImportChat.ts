import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { importMessages } from '../database/chatRepository';
import { importChatRoom } from '../database/exportImportRepository';
import { useChatStore } from '../store/chatStore';

export const useImportChat = () => {
  const db = useSQLiteContext();
  const addChat = useChatStore((state) => state.addChat);

  return useCallback(async () => {
    const importedChat = await importChatRoom();
    if (!importedChat) return;

    try {
      const newChatId = await addChat(importedChat.title, -1);
      if (newChatId) {
        await importMessages(db, newChatId, importedChat.messages);
        router.replace(`/chat/${newChatId}`);
      }
    } catch (error) {
      console.error('Error importing chat:', error);
      Alert.alert('Error', 'Failed to import chat. Please try again.');
    }
  }, [db, addChat]);
};
