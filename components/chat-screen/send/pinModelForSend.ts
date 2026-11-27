import type { Model } from '../../../database/modelRepository';
import type { Attachment } from '../../../hooks/useAttachment';
import { requiresUpdate } from '../../../utils/modelUpdate';
import { useCpuSupportStore } from '../../../store/cpuSupportStore';
import { useLLMStore } from '../../../store/llmStore';
import {
  beginLoadingPinnedModel,
  loadModelPinnedToChat,
} from '../loadModelPinnedToChat';
import type { SendRefusal } from './sendRefusal';

export interface PinModelForSendParams {
  chatId: number;
  model: Model | undefined;
  userInput: string;
  imagePath?: string;
  attachments?: Attachment[];
  isGenerating: boolean;
  isModelLoading: boolean;
  isSwitching: boolean;
  waitForModelSwitch: () => Promise<Model | undefined>;
}

export interface PinnedModel {
  pinnedModel: Model | undefined;
}

export const pinModelForSend = async ({
  chatId,
  model,
  userInput,
  imagePath,
  attachments,
  isGenerating,
  isModelLoading,
  isSwitching,
  waitForModelSwitch,
}: PinModelForSendParams): Promise<PinnedModel | SendRefusal> => {
  const hasDocuments = attachments?.some((a) => a.type === 'document');
  if (!userInput.trim() && !imagePath && !hasDocuments) {
    return 'nothing-to-send';
  }
  if (useCpuSupportStore.getState().lacksLseAtomics) return 'cpu-unsupported';
  let pinnedModel = model;
  if (isSwitching) {
    pinnedModel = (await waitForModelSwitch()) ?? model;
  }
  if (imagePath && pinnedModel && !pinnedModel.vision) {
    return 'image-unsupported';
  }
  if (pinnedModel && requiresUpdate(pinnedModel)) {
    return 'model-needs-update';
  }
  const llm = useLLMStore.getState();
  const busy = llm.isGenerating || llm.isProcessingPrompt;
  if (busy && llm.generatingForChatId !== chatId) {
    llm.interrupt();
  } else if (busy || isGenerating) {
    return 'busy';
  }
  if (!llm.model && !isModelLoading) {
    const started =
      !!pinnedModel && (await beginLoadingPinnedModel(pinnedModel));
    if (!started) return 'model-not-started';
  }
  loadModelPinnedToChat(pinnedModel);
  return { pinnedModel };
};
