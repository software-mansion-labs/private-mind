import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ChatScreen from '../../components/chat-screen/ChatScreen';
import { useDefaultHeader } from '../../hooks/useDefaultHeader';
import { useEffect, useState } from 'react';
import { getChatMessages, Message } from '../../database/chatRepository';
import { useLLMStore } from '../../store/llmStore';
import { useChatHeader } from '../../hooks/useChatHeader';
import RenameChatDialog from '../../components/RenameChatDialog';
import { useChatStore } from '../../store/chatStore';
import { Platform } from 'react-native';

export default function ChatScreenWrapper() {
  useDefaultHeader();
  const { activeChatId, activeChatMessages, db } = useLLMStore();
  const { getChatById, renameChat } = useChatStore();
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = id ? Number(id) : null;
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [renameDialogVisible, setRenameDialogVisible] = useState(false);
  const [chatTitle, setChatTitle] = useState(
    getChatById(chatId as number)?.title || ''
  );

  useChatHeader({
    chatId: chatId as number,
    onRenamePress: setRenameDialogVisible,
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
        <RenameChatDialog
          visible={renameDialogVisible}
          initialTitle={chatTitle}
          onCancel={() => setRenameDialogVisible(false)}
          onConfirm={(newTitle) => {
            if (newTitle && newTitle.trim()) {
              const truncatedInput =
                newTitle.length > 17 ? newTitle.slice(0, 17) + '...' : newTitle;
              renameChat(chatId as number, truncatedInput);
              setChatTitle(truncatedInput);
              setRenameDialogVisible(false);
            }
          }}
        />
      )}

      <ChatScreen chatId={chatId} messageHistory={messageHistory} />
    </>
  );
}
