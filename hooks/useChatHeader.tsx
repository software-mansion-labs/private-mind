import React, { useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useChatStore } from '../store/chatStore';
import SettingsHeaderButton from '../components/SettingsHeaderButton';
import { Model } from '../database/modelRepository';
import ChatTitle from '../components/chat-screen/ChatTitle';

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
        <ChatTitle
          title={chatTitle}
          modelName={chatModel?.modelName || 'No model selected'}
        />
      ),
      headerRight: () => <SettingsHeaderButton chatId={chatId} />,
    });
  }, [navigation, chatId, chatTitle, chatModel]);
};

export default useChatHeader;
