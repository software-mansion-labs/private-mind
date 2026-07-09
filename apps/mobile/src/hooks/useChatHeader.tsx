import React, { useLayoutEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import NewChatHeaderButton from '../components/NewChatHeaderButton';
import { Model } from '../database/modelRepository';
import ChatTitle from '../components/chat-screen/ChatTitle';
import DrawerToggleButton from '../components/drawer/DrawerToggleButton';
import { useNavigation } from 'expo-router';
import { useChatTitleMenu } from '../components/chat-screen/ChatTitleMenu';

interface Props {
  chatId: number;
  chatModel: Model | undefined;
  isEmpty: boolean;
  onSelectModelFromTitle?: () => void;
}

export default function useChatHeader({
  chatId,
  chatModel,
  isEmpty,
  onSelectModelFromTitle,
}: Props) {
  const navigation = useNavigation();
  const { getChatById } = useChatStore();
  const chat = getChatById(chatId);
  const chatTitle = chat ? chat.title : ``;

  const { openMenu, MenuElements } = useChatTitleMenu({
    chatId,
    chatTitle,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <DrawerToggleButton />,
      headerRight: () => <NewChatHeaderButton noOp={isEmpty} />,
      headerTitle: () => (
        <ChatTitle
          title={chatTitle}
          modelName={chatModel?.modelName || 'No model selected'}
          onPress={onSelectModelFromTitle ?? (chat ? openMenu : undefined)}
          showChevron={!!onSelectModelFromTitle}
        />
      ),
    });
  }, [
    navigation,
    chatId,
    chatTitle,
    chatModel,
    openMenu,
    chat,
    isEmpty,
    onSelectModelFromTitle,
  ]);

  return { MenuElements };
}
