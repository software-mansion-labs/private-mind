import { Chat } from '../database/chatRepository';

export const MAX_CHAT_TITLE_LENGTH = 80;

export const chatLabel = (chat: Pick<Chat, 'id' | 'title'>) =>
  chat.title || `Chat ${chat.id}`;

export const toChatTitle = (source: string) => {
  const collapsed = source.replace(/\s+/g, ' ').trim();
  return collapsed.length > MAX_CHAT_TITLE_LENGTH
    ? collapsed.slice(0, MAX_CHAT_TITLE_LENGTH).trimEnd()
    : collapsed;
};
