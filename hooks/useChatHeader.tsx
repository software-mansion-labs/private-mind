import {
  Dispatch,
  SetStateAction,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { useNavigation } from '@react-navigation/native';
import HeaderTitleWithMenu from '../components/HeaderTitleWithMenu';
import { router } from 'expo-router';
import { Platform, Alert } from 'react-native';
import { useChatStore } from '../store/chatStore';

interface Props {
  chatId: number;
  onRenamePress?: Dispatch<SetStateAction<boolean>>;
}

export function useChatHeader({ chatId, onRenamePress }: Props) {
  const navigation = useNavigation();
  const { getChatById, renameChat, deleteChat } = useChatStore();
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    const chat = getChatById(chatId);
    setTitle(chat?.title || 'Chat');
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
              if (text && text.trim()) {
                const truncatedInput =
                  text.length > 17 ? text.slice(0, 17) + '...' : text;

                renameChat(chatId, truncatedInput);
                setTitle(truncatedInput);
              }
            },
          },
        ],
        'plain-text',
        title || ''
      );
    } else {
      onRenamePress?.(true);
    }
  };

  const handleMenuSelect = (action: string) => {
    switch (action) {
      case 'details':
        router.push(`/chat/${chatId}/settings`);
        break;
      case 'rename':
        showRenamePrompt();
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
    if (chatId) {
      navigation.setOptions({
        headerTitle: () => (
          <HeaderTitleWithMenu
            chatId={chatId}
            title={title || `Chat ${chatId}`}
            onSelect={handleMenuSelect}
          />
        ),
      });
    }
  }, [navigation, chatId, title]);
}
