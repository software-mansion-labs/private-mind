import {
  type ConversationMemory,
  type ConversationWindowInput,
  getContextWindowTokens,
  getConversationWindowTokens,
  isExtendedWindowAvailable,
  LARGE_CONTEXT_WINDOW_TOKENS,
} from '../constants/context-window';
import {
  CONTEXT_SIZE_SAME_AS_MEDIUM,
  contextSizeModelLimitCopy,
  contextSizeUnavailableCopy,
  CONVERSATION_MEMORY_DESCRIPTIONS,
  CONVERSATION_MEMORY_OPTION_LABELS,
  formatContextSize,
} from '../constants/conversation-memory-copy';
import type { Model } from '../database/modelRepository';

export interface ContextSizeOption {
  level: ConversationMemory;
  label: string;
  description: string;
  size: string | null;
  note: string | null;
  disabled: boolean;
}

export interface ContextSizeEnvironment {
  model?: Model | null;
  deviceRamGB: number;
  deviceName: string;
  modelCapacityTokens?: number;
  modelFitsDevice?: boolean;
}

const NOMINAL_MODEL_CAPACITY_TOKENS = LARGE_CONTEXT_WINDOW_TOKENS;

const windowFor = (
  model: Model,
  env: ContextSizeEnvironment,
  memory: ConversationMemory
): number => {
  const input: ConversationWindowInput = {
    thinking: false,
    deviceRamGB: env.deviceRamGB,
    modelCapacityTokens:
      env.modelCapacityTokens ?? NOMINAL_MODEL_CAPACITY_TOKENS,
    memory,
    modelFitsDevice: env.modelFitsDevice,
  };
  return getConversationWindowTokens(model, input);
};

interface SizeReport {
  size: string | null;
  note: string | null;
}

const NO_REPORT: SizeReport = { size: null, note: null };

const mediumReport = (
  model: Model,
  env: ContextSizeEnvironment
): SizeReport => {
  const medium = windowFor(model, env, 'medium');
  const size = formatContextSize(medium);
  if (medium > getContextWindowTokens(model)) return { size, note: null };
  return { size, note: contextSizeModelLimitCopy(size) };
};

const highReport = (model: Model, env: ContextSizeEnvironment): SizeReport => {
  const high = windowFor(model, env, 'high');
  const medium = windowFor(model, env, 'medium');
  const size = formatContextSize(high);
  if (high > medium) return { size, note: null };
  if (medium <= getContextWindowTokens(model)) {
    return { size, note: contextSizeModelLimitCopy(size) };
  }
  return { size, note: CONTEXT_SIZE_SAME_AS_MEDIUM };
};

const needsExtendedWindow = (level: ConversationMemory): boolean =>
  level === 'medium' || level === 'high';

const reportFor = (
  level: ConversationMemory,
  env: ContextSizeEnvironment,
  extendedAvailable: boolean
): SizeReport => {
  const { model } = env;
  if (needsExtendedWindow(level) && !extendedAvailable) {
    return {
      size: null,
      note: contextSizeUnavailableCopy(level, env.deviceName),
    };
  }
  if (!model || level === 'auto') return NO_REPORT;
  const reports: Record<
    Exclude<ConversationMemory, 'auto'>,
    () => SizeReport
  > = {
    low: () => ({
      size: formatContextSize(windowFor(model, env, 'low')),
      note: null,
    }),
    medium: () => mediumReport(model, env),
    high: () => highReport(model, env),
  };
  return reports[level]();
};

const CONTEXT_SIZE_DISPLAY_ORDER: readonly ConversationMemory[] = [
  'auto',
  'low',
  'medium',
  'high',
];

export const contextSizeOptionsFor = (
  env: ContextSizeEnvironment
): ContextSizeOption[] => {
  const extendedAvailable = isExtendedWindowAvailable(env.deviceRamGB);
  return CONTEXT_SIZE_DISPLAY_ORDER.map((level) => ({
    level,
    label: CONVERSATION_MEMORY_OPTION_LABELS[level],
    description: CONVERSATION_MEMORY_DESCRIPTIONS[level],
    ...reportFor(level, env, extendedAvailable),
    disabled: needsExtendedWindow(level) && !extendedAvailable,
  }));
};

export const effectiveContextSize = (
  chosen: ConversationMemory,
  deviceRamGB: number
): ConversationMemory =>
  needsExtendedWindow(chosen) && !isExtendedWindowAvailable(deviceRamGB)
    ? 'auto'
    : chosen;
