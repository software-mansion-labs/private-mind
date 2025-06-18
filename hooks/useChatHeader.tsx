import React, { useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useChatStore } from '../store/chatStore';
import ChatTitleWithMenu from '../components/chat-screen/ChatTitleWithMenu';
import SettingsHeaderButton from '../components/SettingsHeaderButton';
import { Model } from '../database/modelRepository';

interface Props {
  chatId: number;
  chatModel: Model | undefined;
}

const useChatHeader = ({ chatId, chatModel }: Props) => {
  const navigation = useNavigation();
  const { getChatById } = useChatStore();
  const chat = getChatById(chatId);
  const chatTitle = chat ? chat.title : `Chat #${chatId}`;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <ChatTitleWithMenu
          title={chatTitle}
          modelName={chatModel?.modelName || 'No model selected'}
        />
      ),
      headerRight: () => <SettingsHeaderButton chatId={chatId} />,
    });
  }, [navigation, chatId, chatTitle, chatModel]);
};

export default useChatHeader;
