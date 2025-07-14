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
import { useSQLiteContext } from 'expo-sqlite';

export default function ChatScreenWrapper() {
  useDefaultHeader();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const chatId = parseInt(rawId);
  const db = useSQLiteContext();
  const { activeChatId, activeChatMessages } = useLLMStore();
  const { getChatById } = useChatStore();
  const { getModelById } = useModelStore();

  const chat = getChatById(chatId);
  const chatModel = chat?.modelId ? getModelById(chat?.modelId) : undefined;
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [model, setModel] = useState<Model | undefined>(chatModel);
  useChatHeader({
    chatId: chatId,
    chatModel: model,
  });

  useEffect(() => {
    (async () => {
      if (!chatId) return;
      if (chatId != activeChatId) {
        const history = await getChatMessages(db, chatId);
        setMessageHistory(history);
      }
    })();
  }, [chatId]);

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
        model={model}
        selectModel={setModel}
      />
    </WithDrawerGesture>
  );
}
