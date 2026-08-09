import { type Message } from '../database/chatRepository';

export const messageRowKey = (message: Message, index: number): string => {
  if (message.localId != null) return `local-${message.localId}`;
  if (message.id > 0) return `msg-${message.id}`;
  return `pending-${message.role}-${index}`;
};
