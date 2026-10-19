import type { Message } from '../../database/chatRepository';

export const endsTurnCutShort = (
  messages: readonly Message[],
  index: number
): boolean => {
  const message = messages[index];
  if (!message?.cutShortReason) return false;
  return (
    message.role === 'assistant' || messages[index + 1]?.role !== 'assistant'
  );
};
