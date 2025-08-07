import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ChatScreen from '../../../components/chat-screen/ChatScreen';
import { useEffect, useState } from 'react';
import { useLLMStore } from '../../../store/llmStore';
import { useModelStore } from '../../../store/modelStore';
import { Model } from '../../../database/modelRepository';
import { useChatStore } from '../../../store/chatStore';
import useChatHeader from '../../../hooks/useChatHeader';

export default function ChatScreenWrapper() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const { modelId }: { modelId: string } = useLocalSearchParams();

  const { activeChatMessages, setActiveChatId } = useLLMStore();
  const { getModelById } = useModelStore();
  const { getChatById, setChatModel, loadChats } = useChatStore();

  const chatId = parseInt(rawId);
  const chat = getChatById(chatId);

  const [model, setModel] = useState<Model | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useChatHeader({
    chatId: chatId,
    chatModel: model,
  });

  useEffect(() => {
    const resolvedModelId = modelId ?? chat?.modelId;
    if (resolvedModelId) {
      const newModel = getModelById(parseInt(resolvedModelId.toString()));
      setModel(newModel);
    }
  }, [modelId, chat?.modelId, getModelById]);

  useEffect(() => {
    (async () => {
      await setActiveChatId(chatId);
      setIsLoading(false);
    })();
  }, [chatId]);

  const handleSetModel = async (model: Model) => {
    setChatModel(chatId, model.id);
    loadChats();
    setModel(model);
  };

  return (
    <ChatScreen
      chatId={chatId}
      messageHistory={isLoading ? [] : activeChatMessages}
      model={model}
      selectModel={handleSetModel}
    />
  );
}
