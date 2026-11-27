import Toast from 'react-native-toast-message';
import type { SQLiteDatabase } from 'expo-sqlite';
import { checkIfChatExists } from '../../../database/chatRepository';
import type { Model } from '../../../database/modelRepository';
import type { Attachment } from '../../../hooks/useAttachment';
import { persistImage } from '../../../utils/persistImage';
import { toChatTitle } from '../../../utils/chatLabel';
import { stripThinkMarkers } from '../../../utils/thinking';
import { useLLMStore } from '../../../store/llmStore';
import { useWebSearchStore } from '../../../store/webSearchStore';
import type { SendRefusal } from './sendRefusal';

export interface PrepareChatForSendParams {
  db: SQLiteDatabase;
  chatId: number;
  pinnedModel: Model | undefined;
  userInput: string;
  imagePath?: string;
  attachments?: Attachment[];
  addChat: (title: string, modelId: number) => Promise<number | undefined>;
}

export interface PreparedChat {
  targetChatId: number;
  isNewChat: boolean;
  persistedImagePath: string | undefined;
}

const titleFor = (userInput: string, attachments?: Attachment[]): string => {
  const docName = attachments?.find((a) => a.type === 'document')?.name;
  return toChatTitle(
    stripThinkMarkers(userInput).trim() || docName || 'New chat'
  );
};

export const prepareChatForSend = async ({
  db,
  chatId,
  pinnedModel,
  userInput,
  imagePath,
  attachments,
  addChat,
}: PrepareChatForSendParams): Promise<PreparedChat | SendRefusal | false> => {
  let targetChatId = chatId;
  const isNewChat = !(await checkIfChatExists(db, targetChatId));
  const llm = useLLMStore.getState();
  if (llm.isGenerating || llm.isProcessingPrompt) return false;
  if (isNewChat) {
    const newChatId = await addChat(
      titleFor(userInput, attachments),
      pinnedModel!.id
    );
    if (!newChatId) return 'chat-not-created';
    targetChatId = newChatId;
    useWebSearchStore.getState().transfer(chatId, targetChatId);
  }

  let persistedImagePath: string | undefined = imagePath;
  if (imagePath) {
    try {
      persistedImagePath = await persistImage(imagePath);
    } catch (error) {
      console.error('Failed to persist image attachment:', error);
      Toast.show({
        type: 'defaultToast',
        text1: 'Failed to save image attachment.',
      });
      return 'image-not-saved';
    }
  }

  return { targetChatId, isNewChat, persistedImagePath };
};
