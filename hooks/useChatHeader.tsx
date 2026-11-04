import React, { useCallback, useLayoutEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChatStore } from '../store/chatStore';
import NewChatHeaderButton from '../components/NewChatHeaderButton';
import ChatTitle from '../components/chat-screen/ChatTitle';
import DrawerToggleButton from '../components/drawer/DrawerToggleButton';
import { useNavigation } from 'expo-router';
import { useChatMenu } from '../components/chat-menu/useChatMenu';
import { chatLabel } from '../utils/chatLabel';
import { headerTitleMaxWidth } from '../constants/chat-screen';

interface Props {
  chatId: number;
  isEmpty: boolean;
  hideTitle?: boolean;
}

export default function useChatHeader({
  chatId,
  isEmpty,
  hideTitle = false,
}: Props) {
  const navigation = useNavigation();
  const { getChatById } = useChatStore();
  const chat = getChatById(chatId);
  const chatTitle = chat ? chat.title : ``;
  const [titleBottom, setTitleBottom] = useState<number>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const titleMaxWidth = headerTitleMaxWidth(width, insets);

  const { openMenu, openChatId, MenuElements } = useChatMenu();
  const isOpen = openChatId === chatId;
  const menuTitle = chatLabel({ id: chatId, title: chatTitle });

  const openTitleMenu = useCallback(
    () =>
      openMenu(
        { id: chatId, title: chatTitle },
        { x: 0, y: titleBottom ?? 0, width, height: 0, align: 'center' }
      ),
    [openMenu, chatId, chatTitle, titleBottom, width]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitleContainerStyle: { maxWidth: titleMaxWidth },
      headerLeft: () => <DrawerToggleButton glass />,
      headerRight: () => <NewChatHeaderButton noOp={isEmpty} glass />,
      headerTitle: hideTitle
        ? () => null
        : () => (
            <ChatTitle
              title={chat ? menuTitle : ''}
              open={isOpen}
              onPress={chat ? openTitleMenu : undefined}
              onBottomMeasured={setTitleBottom}
              maxWidth={titleMaxWidth}
            />
          ),
    });
  }, [
    navigation,
    chatId,
    chatTitle,
    menuTitle,
    isOpen,
    openTitleMenu,
    chat,
    isEmpty,
    hideTitle,
    titleMaxWidth,
  ]);

  return { MenuElements, titleBottom: hideTitle ? undefined : titleBottom };
}
