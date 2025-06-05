import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ChatScreen from '../../components/chat-screen/ChatScreen';
import { useDefaultHeader } from '../../hooks/useDefaultHeader';
import { useEffect, useState } from 'react';
import { useLLMStore } from '../../store/llmStore';
import useChatHeader from '../../hooks/useChatHeader';
import RenameChatAndroidDialog from '../../components/chat-screen/RenameChatAndroidDialog';
import { useChatStore } from '../../store/chatStore';
import { Platform } from 'react-native';
import { useModelStore } from '../../store/modelStore';
import { getChatMessages, Message } from '../../database/chatRepository';

export default function ChatScreenWrapper() {
  useDefaultHeader();
  const { db, activeChatId, activeChatMessages } = useLLMStore();
  const { getChatById, renameChat } = useChatStore();
  const { getModelById } = useModelStore();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const chatId = id ? Number(id) : null;
  const chat = getChatById(chatId as number);
  const model = getModelById(chat?.model || '');
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
    handleChatRename: handleChatRename,
  });

  useEffect(() => {
    (async () => {
      if (!db || !chatId) return;
      if (chatId != activeChatId) {
        const history = await getChatMessages(db, chatId);
        setMessageHistory(history);
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

      <ChatScreen
        chatId={chatId}
        messageHistory={messageHistory}
        model={model || null}
      />
    </>
  );
}
