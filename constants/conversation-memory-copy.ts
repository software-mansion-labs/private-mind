import type { ConversationMemory } from './context-window';

export const CONVERSATION_MEMORY_LABEL = 'Context size';

export const CONVERSATION_MEMORY_OPTION_LABELS: Record<
  ConversationMemory,
  string
> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  auto: 'Auto',
};

export const CONVERSATION_MEMORY_DESCRIPTIONS: Record<
  ConversationMemory,
  string
> = {
  low: 'Fastest replies. Remembers the recent part of a chat.',
  medium: 'Remembers more of a long chat. Replies start a little slower.',
  high: 'Longest memory. Replies start slower and use more battery.',
  auto: 'Picks the size for you. Goes larger only to read an attached document whole, when it fits.',
};

export const contextSizeUnavailableCopy = (
  level: ConversationMemory,
  deviceName: string
) =>
  `${CONVERSATION_MEMORY_OPTION_LABELS[level]} is not available on ${deviceName}.`;

export const CONTEXT_SIZE_AUTO_HEADER = 'Automatic';
export const CONTEXT_SIZE_MANUAL_HEADER = 'Manual';

export const CONTEXT_SIZE_SAME_AS_MEDIUM = 'Same as Medium on this phone';
export const contextSizeModelLimitCopy = (size: string) =>
  `This model goes up to ${size}`;

const TOKENS_PER_KILO = 1024;

export const formatContextSize = (tokens: number): string =>
  tokens >= TOKENS_PER_KILO && tokens % TOKENS_PER_KILO === 0
    ? `${tokens / TOKENS_PER_KILO}k`
    : `${tokens}`;
