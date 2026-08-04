import { type Message } from '../database/chatRepository';

/**
 * Identifies a message row for both React reconciliation and height
 * measurement. The two must agree: the measurement handlers drop any layout
 * event whose key does not match the row they expect, and a dropped event
 * leaves that row's height at 0.
 */
export const messageRowKey = (message: Message, index: number): string => {
  if (message.localId != null) return `local-${message.localId}`;
  if (message.id > 0) return `msg-${message.id}`;
  return `pending-${message.role}-${index}`;
};
