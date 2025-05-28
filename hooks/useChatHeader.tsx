import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useLayoutEffect,
} from 'react';
import { useNavigation } from '@react-navigation/native';
import HeaderTitleWithMenu from '../components/chat-screen/ChatTitleWithMenu';
import { router } from 'expo-router';
import { Platform, Alert } from 'react-native';
import { useChatStore } from '../store/chatStore';
import {
  exportChatRoom,
  importChatRoom,
} from '../database/exportImportRepository';
import { importMessages } from '../database/chatRepository';

interface Props {
  chatId: number;
  onRenamePress: Dispatch<SetStateAction<boolean>>;
  chatTitle: string;
  setChatTitle: Dispatch<SetStateAction<string>>;
  handleChatRename: (newTitle: string) => Promise<void>;
}

const useChatHeader = ({
  chatId,
  onRenamePress,
  chatTitle,
  setChatTitle,
  handleChatRename,
}: Props) => {
  const navigation = useNavigation();
  const { getChatById, renameChat, deleteChat, db } = useChatStore();

  useEffect(() => {
    const chat = getChatById(chatId);
    if (chat?.title) {
      setChatTitle(chat.title);
    }
  }, [chatId, getChatById]);

  const showRenamePrompt = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Rename Chat',
        'Enter a new chat name:',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'OK',
            onPress: (text) => {
              if (text) {
                handleChatRename(text);
              }
            },
          },
        ],
        'plain-text',
        chatTitle
      );
    } else {
      onRenamePress(true);
    }
  };

  const handleMenuSelect = async (action: string) => {
    switch (action) {
      case 'details':
        router.push(`/chat/${chatId}/settings`);
        break;
      case 'rename':
        showRenamePrompt();
        break;
      case 'export':
        await exportChatRoom(db!, chatId, chatTitle);
        break;
      case 'import':
        const importedChat = await importChatRoom();
        if (importedChat) {
          try {
            const newChatId = await useChatStore
              .getState()
              .addChat(importedChat.title);
            if (newChatId) {
              await importMessages(db!, newChatId, importedChat.messages);
              router.push(`/chat/${newChatId}`);
            }
          } catch (error) {
            console.error('Error importing chat:', error);
            Alert.alert('Error', 'Failed to import chat. Please try again.');
          }
        }
        break;
      case 'delete':
        Alert.alert(
          'Delete Chat',
          'Are you sure you want to delete this chat?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deleteChat(chatId);
                  router.replace('/');
                } catch (error) {
                  console.error('Error deleting chat:', error);
                  Alert.alert(
                    'Error',
                    'Failed to delete chat. Please try again.'
                  );
                }
              },
            },
          ]
        );
        break;
      default:
        console.warn(`Unknown action: ${action}`);
        break;
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <HeaderTitleWithMenu title={chatTitle} onSelect={handleMenuSelect} />
      ),
    });
  }, [navigation, chatId, chatTitle]);
};

export default useChatHeader;
