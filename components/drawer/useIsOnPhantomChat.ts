import { usePathname } from 'expo-router';
import { useChatStore } from '../../store/chatStore';

export const useIsOnPhantomChat = () => {
  const pathname = usePathname();
  const { phantomChat, getChatById } = useChatStore();

  return (
    phantomChat != null &&
    pathname === `/chat/${phantomChat.id}` &&
    !getChatById(phantomChat.id)
  );
};
