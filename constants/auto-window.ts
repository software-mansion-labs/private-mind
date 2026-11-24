import {
  EXTENDED_CONTEXT_WINDOW_TOKENS,
  LARGE_CONTEXT_WINDOW_TOKENS,
  LARGE_WINDOW_MIN_DEVICE_RAM_GB,
  type ConversationMemory,
} from './context-window';

export type AutoWindowReason =
  | 'not-auto'
  | 'thinking'
  | 'unknown-capacity'
  | 'small-capacity'
  | 'weak-device'
  | 'memory-gate'
  | 'no-document'
  | 'document-too-large'
  | 'whole-document';

export interface WindowEnvironment {
  memory: ConversationMemory;
  thinking: boolean;
  deviceRamGB: number;
  modelCapacityTokens?: number;
  modelFitsDevice: boolean;
}

export interface AutoWindowInput extends WindowEnvironment {
  documentAttached: boolean;
  documentTokens: number;
  wholeDocumentBudgetTokens: number;
}

export interface AutoWindowDecision {
  ceilingTokens: number;
  reason: AutoWindowReason;
}

const standard = (reason: AutoWindowReason): AutoWindowDecision => ({
  ceilingTokens: EXTENDED_CONTEXT_WINDOW_TOKENS,
  reason,
});

const large = (reason: AutoWindowReason): AutoWindowDecision => ({
  ceilingTokens: LARGE_CONTEXT_WINDOW_TOKENS,
  reason,
});

const usesLargeWindowWhenReachable = (memory: ConversationMemory): boolean =>
  memory === 'auto' || memory === 'high';

export const largeWindowBlocker = (
  input: WindowEnvironment
): AutoWindowReason | null => {
  if (!usesLargeWindowWhenReachable(input.memory)) return 'not-auto';
  if (input.thinking) return 'thinking';
  if (input.modelCapacityTokens === undefined) return 'unknown-capacity';
  if (input.modelCapacityTokens < LARGE_CONTEXT_WINDOW_TOKENS) {
    return 'small-capacity';
  }
  if (Math.ceil(input.deviceRamGB) < LARGE_WINDOW_MIN_DEVICE_RAM_GB) {
    return 'weak-device';
  }
  if (!input.modelFitsDevice) return 'memory-gate';
  return null;
};

const documentFitsWhole = (input: AutoWindowInput): boolean =>
  input.documentTokens > 0 &&
  input.documentTokens <= input.wholeDocumentBudgetTokens;

export const decideAutoWindow = (
  input: AutoWindowInput
): AutoWindowDecision => {
  const blocked = largeWindowBlocker(input);
  if (blocked) return standard(blocked);
  const notRaised = (reason: AutoWindowReason) =>
    standard(input.memory === 'auto' ? reason : 'not-auto');
  if (!input.documentAttached) return notRaised('no-document');
  if (!documentFitsWhole(input)) return notRaised('document-too-large');
  return large('whole-document');
};
