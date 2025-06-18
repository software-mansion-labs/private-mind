import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ChatScreen from '../../components/chat-screen/ChatScreen';
import { useDefaultHeader } from '../../hooks/useDefaultHeader';
import { useEffect, useState } from 'react';
import { useLLMStore } from '../../store/llmStore';
import useChatHeader from '../../hooks/useChatHeader';
import { useChatStore } from '../../store/chatStore';
import { useModelStore } from '../../store/modelStore';
import { getChatMessages, Message } from '../../database/chatRepository';
import { Model } from '../../database/modelRepository';
import WithDrawerGesture from '../../components/WithDrawerGesture';

export default function ChatScreenWrapper() {
  useDefaultHeader();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, activeChatId, activeChatMessages } = useLLMStore();
  const { getChatById } = useChatStore();
  const { getModelById } = useModelStore();

  const chatId = id ? Number(id) : null;
  const chat = getChatById(chatId as number);
  const chatModel = getModelById(chat?.model ?? -1);

  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [model, setModel] = useState<Model | null>(chatModel || null);
  useChatHeader({
    chatId: chatId as number,
    chatModel: model,
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
    <WithDrawerGesture>
      <ChatScreen
        chatId={chatId}
        messageHistory={messageHistory}
        model={model || null}
        selectModel={setModel}
      />
    </WithDrawerGesture>
  );
}
