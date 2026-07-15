import { useCallback } from 'react';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { useSQLiteContext } from 'expo-sqlite';
import { useChatStore } from '../store/chatStore';
import { useVectorStore } from '../context/VectorStoreContext';
import { exportChatRoom } from '../database/exportImportRepository';
import { useConfirm } from './useConfirm';

const MAX_TITLE_LENGTH = 25;

interface Options {
  onDeleted?: (chatId: number) => void;
}

export const useChatActions = ({ onDeleted }: Options = {}) => {
  const db = useSQLiteContext();
  const { renameChat, deleteChat } = useChatStore();
  const { vectorStore } = useVectorStore();
  const { confirm, ConfirmElement } = useConfirm();

  const rename = useCallback(
    async (chatId: number, newTitle: string) => {
      const clipped =
        newTitle.length > MAX_TITLE_LENGTH
          ? newTitle.slice(0, MAX_TITLE_LENGTH) + '...'
          : newTitle;
      try {
        await renameChat(chatId, clipped);
        Toast.show({
          type: 'defaultToast',
          text1: 'Chat renamed',
        });
      } catch (error) {
        console.error('Error renaming chat:', error);
        Alert.alert('Error', 'Failed to rename chat. Please try again.');
      }
    },
    [renameChat]
  );

  const exportChat = useCallback(
    async (chatId: number, chatTitle: string) => {
      try {
        await exportChatRoom(db, chatId, chatTitle);
      } catch (error) {
        console.error('Error exporting chat:', error);
        Alert.alert('Error', 'Failed to export chat. Please try again.');
      }
    },
    [db]
  );

  const confirmDelete = useCallback(
    async (chatId: number) => {
      const confirmed = await confirm({
        title: 'Delete Chat',
        message: 'Are you sure you want to delete this chat?',
        confirmLabel: 'Delete',
      });
      if (!confirmed) return;

      try {
        await deleteChat(chatId, vectorStore ?? undefined);
        onDeleted?.(chatId);
      } catch (error) {
        console.error('Error deleting chat:', error);
        Alert.alert('Error', 'Failed to delete chat. Please try again.');
      }
    },
    [confirm, deleteChat, vectorStore, onDeleted]
  );

  return { rename, exportChat, confirmDelete, ConfirmElement };
};
