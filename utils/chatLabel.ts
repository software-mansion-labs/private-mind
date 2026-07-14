import { Chat } from '../database/chatRepository';

export const chatLabel = (chat: Pick<Chat, 'id' | 'title'>) =>
  chat.title || `Chat ${chat.id}`;
