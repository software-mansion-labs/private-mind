import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import type { ChatSettings, Message } from '../../database/chatRepository';
import { Model } from '../../database/modelRepository';
import { Attachment } from '../../hooks/useAttachment';
import { LFMEmbeddings } from '../../utils/lfmEmbeddings';
import { useChatStore } from '../../store/chatStore';
import { useLLMStore } from '../../store/llmStore';
import { useWebSearchStore } from '../../store/webSearchStore';
import type { MessagesHandle } from './Messages';
import { dismissKeyboardAfterUiUpdates } from '../../utils/afterUiUpdates';
import { createSourceBuilder } from './send/createSourceBuilder';
import { pinModelForSend } from './send/pinModelForSend';
import { prepareChatForSend } from './send/prepareChatForSend';
import type { SendRefusal } from './send/sendRefusal';

interface UseSendChatMessageOptions {
  chatId: number;
  model: Model | undefined;
  messageHistory: Message[];
  chatSettings: {
    systemPrompt: string;
    thinkingEnabled: boolean;
  };
  enabledSources: number[];
  vectorStore: OPSQLiteVectorStore | null;
  embeddings: LFMEmbeddings | null;
  messagesRef: React.RefObject<MessagesHandle | null>;
  db: SQLiteDatabase;
  isGenerating: boolean;
  isModelLoading: boolean;
  isSwitching: boolean;
  waitForModelSwitch: () => Promise<Model | undefined>;
}

const documentNamesOf = (attachments?: Attachment[]): string | undefined =>
  (attachments ?? [])
    .filter((attachment) => attachment.type === 'document')
    .map((attachment) => attachment.name)
    .filter(Boolean)
    .join(', ') || undefined;

export const useSendChatMessage = ({
  chatId,
  model,
  messageHistory,
  chatSettings,
  enabledSources,
  vectorStore,
  embeddings,
  messagesRef,
  db,
  isGenerating,
  isModelLoading,
  isSwitching,
  waitForModelSwitch,
}: UseSendChatMessageOptions) => {
  const { sendChatMessage, runWithModelOffloaded } = useLLMStore();
  const { addChat, updateLastUsed, enableSource } = useChatStore();

  return async (
    userInput: string,
    imagePath?: string,
    attachments?: Attachment[]
  ): Promise<boolean | SendRefusal> => {
    const pinned = await pinModelForSend({
      chatId,
      model,
      userInput,
      imagePath,
      attachments,
      isGenerating,
      isModelLoading,
      isSwitching,
      waitForModelSwitch,
    });
    if (typeof pinned === 'string') return pinned;

    messagesRef.current?.onMessageSent();
    dismissKeyboardAfterUiUpdates();

    const prepared = await prepareChatForSend({
      db,
      chatId,
      pinnedModel: pinned.pinnedModel,
      userInput,
      imagePath,
      attachments,
      addChat,
    });
    if (prepared === false || typeof prepared === 'string') {
      messagesRef.current?.cancelMessageSent();
      return prepared;
    }
    const { targetChatId, isNewChat, persistedImagePath } = prepared;

    updateLastUsed(targetChatId);
    useWebSearchStore.getState().resetTrace();

    const settings: ChatSettings = {
      systemPrompt: chatSettings.systemPrompt,
      thinkingEnabled: chatSettings.thinkingEnabled,
    };
    const buildSources = createSourceBuilder({
      targetChatId,
      userInput,
      imagePath,
      attachments,
      history: messageHistory,
      enabledSources,
      systemPrompt: chatSettings.systemPrompt,
      thinkingEnabled: chatSettings.thinkingEnabled,
      vectorStore,
      embeddings,
      runWithModelOffloaded,
      enableSource,
    });
    const generation = sendChatMessage(
      userInput,
      targetChatId,
      buildSources,
      settings,
      persistedImagePath,
      documentNamesOf(attachments)
    );
    if (isNewChat && targetChatId !== chatId) {
      router.replace(`/chat/${targetChatId}`);
    }

    return generation;
  };
};
