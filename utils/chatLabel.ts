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

export interface MeasuredLine {
  text: string;
}

export const firstLineOf = (
  lines: readonly MeasuredLine[],
  full: string
): string => {
  if (lines.length <= 1) return full;
  const first = lines[0].text.trimEnd();
  return first || full;
};
