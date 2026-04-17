import React, { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useSQLiteContext } from 'expo-sqlite';
import { useChatStore } from '../../store/chatStore';
import { useVectorStore } from '../../context/VectorStoreContext';
import { exportChatRoom } from '../../database/exportImportRepository';
import RenameChatModal from './RenameChatModal';

interface Options {
  chatId: number;
  chatTitle: string;
}

const SHEET_TITLE = 'Chat';

export const useChatTitleMenu = ({ chatId, chatTitle }: Options) => {
  const db = useSQLiteContext();
  const { renameChat, deleteChat } = useChatStore();
  const { vectorStore } = useVectorStore();
  const [renameVisible, setRenameVisible] = useState(false);

  const handleRenameSubmit = useCallback(
    async (newTitle: string) => {
      setRenameVisible(false);
      const clipped =
        newTitle.length > 25 ? newTitle.slice(0, 25) + '...' : newTitle;
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
    [chatId, renameChat]
  );

  const handleExport = useCallback(async () => {
    try {
      await exportChatRoom(db, chatId, chatTitle);
    } catch (error) {
      console.error('Error exporting chat:', error);
      Alert.alert('Error', 'Failed to export chat. Please try again.');
    }
  }, [db, chatId, chatTitle]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete Chat', 'Are you sure you want to delete this chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteChat(chatId, vectorStore ?? undefined);
            router.replace('/');
          } catch (error) {
            console.error('Error deleting chat:', error);
            Alert.alert('Error', 'Failed to delete chat. Please try again.');
          }
        },
      },
    ]);
  }, [chatId, deleteChat, vectorStore]);

  const openMenu = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: SHEET_TITLE,
          options: ['Rename', 'Export Chat', 'Delete Chat', 'Cancel'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 3,
        },
        (index) => {
          if (index === 0) setRenameVisible(true);
          else if (index === 1) handleExport();
          else if (index === 2) handleDelete();
        }
      );
    } else {
      Alert.alert(SHEET_TITLE, undefined, [
        { text: 'Rename', onPress: () => setRenameVisible(true) },
        { text: 'Export Chat', onPress: handleExport },
        { text: 'Delete Chat', style: 'destructive', onPress: handleDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [handleExport, handleDelete]);

  const RenameModalElement = (
    <RenameChatModal
      visible={renameVisible}
      initialTitle={chatTitle}
      onCancel={() => setRenameVisible(false)}
      onSubmit={handleRenameSubmit}
    />
  );

  return { openMenu, RenameModalElement };
};
