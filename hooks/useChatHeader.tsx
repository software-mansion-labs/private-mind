import React, { useLayoutEffect } from 'react';
import { useChatStore } from '../store/chatStore';
import SettingsHeaderButton from '../components/SettingsHeaderButton';
import { Model } from '../database/modelRepository';
import ChatTitle from '../components/chat-screen/ChatTitle';
import DrawerToggleButton from '../components/drawer/DrawerToggleButton';
import { useNavigation } from 'expo-router';

interface Props {
  chatId: number;
  chatModel: Model | undefined;
}

export default function useChatHeader({ chatId, chatModel }: Props) {
  const navigation = useNavigation();
  const { getChatById } = useChatStore();
  const chat = getChatById(chatId);
  const chatTitle = chat ? chat.title : ``;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <DrawerToggleButton />,
      headerRight: () => <SettingsHeaderButton chatId={chatId} />,
      headerTitle: () => (
        <ChatTitle
          title={chatTitle}
          modelName={chatModel?.modelName || 'No model selected'}
        />
      ),
    });
  }, [navigation, chatId, chatTitle, chatModel]);
}
