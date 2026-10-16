import React, { useLayoutEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChatStore } from '../store/chatStore';
import NewChatHeaderButton from '../components/NewChatHeaderButton';
import { Model } from '../database/modelRepository';
import ChatTitle from '../components/chat-screen/ChatTitle';
import DrawerToggleButton from '../components/drawer/DrawerToggleButton';
import { useNavigation } from 'expo-router';
import { useChatTitleMenu } from '../components/chat-screen/ChatTitleMenu';
import { headerTitleMaxWidth } from '../constants/chat-screen';

interface Props {
  chatId: number;
  chatModel: Model | undefined;
  isModelLoading?: boolean;
  isEmpty: boolean;
  hideTitle?: boolean;
}

export default function useChatHeader({
  chatId,
  chatModel,
  isModelLoading = false,
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

  const { openMenu, MenuElements } = useChatTitleMenu({
    chatId,
    chatTitle,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitleContainerStyle: { maxWidth: titleMaxWidth },
      headerLeft: () => <DrawerToggleButton />,
      headerRight: () => <NewChatHeaderButton noOp={isEmpty} />,
      headerTitle: hideTitle
        ? () => null
        : () => (
            <ChatTitle
              title={chatTitle}
              modelName={chatModel?.modelName || 'No model selected'}
              isModelLoading={isModelLoading}
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
    chatModel,
    isModelLoading,
    openMenu,
    chat,
    isEmpty,
    hideTitle,
    titleMaxWidth,
  ]);

  return { MenuElements, titleBottom: hideTitle ? undefined : titleBottom };
}
