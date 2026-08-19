import React, { useLayoutEffect, useState } from 'react';
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
  isModelLoading?: boolean;
  isEmpty: boolean;
  onSelectModelFromTitle?: () => void;
}

export default function useChatHeader({
  chatId,
  chatModel,
  isModelLoading = false,
  isEmpty,
  onSelectModelFromTitle,
}: Props) {
  const navigation = useNavigation();
  const { getChatById } = useChatStore();
  const chat = getChatById(chatId);
  const chatTitle = chat ? chat.title : ``;
  const [titleBottom, setTitleBottom] = useState<number>();

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
          isModelLoading={isModelLoading}
          onPress={onSelectModelFromTitle ?? (chat ? openMenu : undefined)}
          showChevron={!!onSelectModelFromTitle}
          onBottomMeasured={setTitleBottom}
        />
      ),
    });
  }, [
    navigation,
    chatId,
    chatTitle,
    chatModel,
    isModelLoading,
    openMenu,
    chat,
    isEmpty,
    onSelectModelFromTitle,
  ]);

  return { MenuElements, titleBottom };
}
