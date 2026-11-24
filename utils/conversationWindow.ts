import {
  type ConversationMemory,
  type ConversationWindowInput,
} from '../constants/context-window';
import type { Model } from '../database/modelRepository';
import { useSettingsStore } from '../store/settingsStore';
import { deviceMemoryGBOrZero } from './deviceMemory';
import { isModelCompatibleWithRam } from './modelCompatibility';
import { modelContextCapacity } from './modelContextCapacity';

export const chosenConversationMemory = (): ConversationMemory =>
  useSettingsStore.getState().conversationMemory;

export const conversationWindowFor = (
  model: Model,
  {
    memory,
    thinkingEnabled,
    carriesSources = false,
    ceilingTokens,
  }: {
    memory: ConversationMemory;
    thinkingEnabled?: boolean;
    carriesSources?: boolean;
    ceilingTokens?: number;
  }
): ConversationWindowInput => {
  const deviceRamGB = deviceMemoryGBOrZero();
  return {
    thinking: !!thinkingEnabled && !!model.thinking,
    deviceRamGB,
    modelCapacityTokens: modelContextCapacity(model.id),
    memory,
    carriesSources,
    ...(ceilingTokens === undefined ? {} : { ceilingTokens }),
    modelFitsDevice: isModelCompatibleWithRam(model, deviceRamGB),
  };
};
