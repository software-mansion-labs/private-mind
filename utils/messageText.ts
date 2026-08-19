import type { Message } from '../database/chatRepository';
import { stripCitations } from './citations';
import {
  stripThinkBlocks,
  stripThinkMarkers,
  thinkBlocksText,
} from './thinking';

export const visibleMessageText = (message: Message): string => {
  if (message.role !== 'assistant') return stripThinkMarkers(message.content);

  const answer =
    stripThinkBlocks(message.content) || thinkBlocksText(message.content);

  return message.sourceDocuments?.length
    ? stripCitations(answer).trim()
    : answer;
};
