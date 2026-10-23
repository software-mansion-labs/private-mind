import React, { useLayoutEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChatStore } from '../store/chatStore';
import NewChatHeaderButton from '../components/NewChatHeaderButton';
import ChatTitle from '../components/chat-screen/ChatTitle';
import DrawerToggleButton from '../components/drawer/DrawerToggleButton';
import { useNavigation } from 'expo-router';
import { useChatTitleMenu } from '../components/chat-screen/ChatTitleMenu';
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

  const { openMenu, isOpen, menuTitle, MenuElements } = useChatTitleMenu({
    chatId,
    chatTitle,
    anchorTop: titleBottom,
  });

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
              onPress={chat ? openMenu : undefined}
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
    openMenu,
    chat,
    isEmpty,
    hideTitle,
    titleMaxWidth,
  ]);

  return { MenuElements, titleBottom: hideTitle ? undefined : titleBottom };
}
