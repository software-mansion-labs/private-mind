import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ChatScreen from '../../components/chat-screen/ChatScreen';
import { useDefaultHeader } from '../../hooks/useDefaultHeader';
import { useEffect, useState } from 'react';
import { getChatMessages, Message } from '../../database/chatRepository';
import { useLLMStore } from '../../store/llmStore';
import useChatHeader from '../../hooks/useChatHeader';
import RenameChatAndroidDialog from '../../components/chat-screen/RenameChatAndroidDialog';
import { useChatStore } from '../../store/chatStore';
import { Platform } from 'react-native';

export default function ChatScreenWrapper() {
  useDefaultHeader();
  const { activeChatId, activeChatMessages, db } = useLLMStore();
  const { getChatById, renameChat } = useChatStore();
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = id ? Number(id) : null;

  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  /*
    For iOS, we are using default prompt alert which doesn't
    exist on Android. That's why we have to use a custom dialog which is a component and can't be returned from a hook.
  */
  const [renameDialogVisible, setRenameDialogVisible] = useState(false);
  const [chatTitle, setChatTitle] = useState(
    getChatById(chatId as number)?.title || `Chat #${chatId}`
  );

  const handleChatRename = async (newTitle: string) => {
    if (newTitle.trim()) {
      // truncating new chat title to fixed length
      const newChatTitle =
        newTitle.length > 25 ? newTitle.slice(0, 25) + '...' : newTitle;
      await renameChat(chatId as number, newChatTitle);
      setChatTitle(newChatTitle);
      setRenameDialogVisible(false);
    }
  };

  useChatHeader({
    chatId: chatId as number,
    onRenamePress: setRenameDialogVisible,
    chatTitle: chatTitle,
    setChatTitle: setChatTitle,
    handleChatRename: handleChatRename,
  });

  useEffect(() => {
    (async () => {
      if (chatId !== null && db !== null) {
        const messages = await getChatMessages(db, chatId);
        setMessageHistory(messages);
      } else {
        setMessageHistory([]);
      }
    })();
  }, [chatId, db]);

  useEffect(() => {
    if (activeChatId === chatId && activeChatMessages.length > 0) {
      setMessageHistory(activeChatMessages);
    }
  }, [activeChatMessages, activeChatId, chatId]);

  return (
    <>
      {Platform.OS === 'android' && (
        <RenameChatAndroidDialog
          visible={renameDialogVisible}
          initialTitle={chatTitle}
          onCancel={() => setRenameDialogVisible(false)}
          onConfirm={handleChatRename}
        />
      )}

      <ChatScreen chatId={chatId} messageHistory={messageHistory} />
    </>
  );
}
