import { Chat } from '../database/chatRepository';

export const MAX_CHAT_TITLE_LENGTH = 80;

export const chatLabel = (chat: Pick<Chat, 'id' | 'title'>) =>
  chat.title || `Chat ${chat.id}`;

const WORD_BREAK_FLOOR = Math.floor(MAX_CHAT_TITLE_LENGTH / 2);

export const toChatTitle = (source: string) => {
  const collapsed = source.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= MAX_CHAT_TITLE_LENGTH) return collapsed;

  const clipped = collapsed.slice(0, MAX_CHAT_TITLE_LENGTH);
  const lastBreak = clipped.lastIndexOf(' ');

  return (
    lastBreak >= WORD_BREAK_FLOOR ? clipped.slice(0, lastBreak) : clipped
  ).trimEnd();
};
