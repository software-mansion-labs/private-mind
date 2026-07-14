import { Chat } from '../../database/chatRepository';
import { chatLabel } from '../../utils/chatLabel';

const DAY_MS = 1000 * 60 * 60 * 24;

export const getRelativeDateSection = (date: Date, now: Date): string => {
  const diffDays = Math.floor((now.getTime() - date.getTime()) / DAY_MS);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 6) return `${diffDays} days ago`;
  if (diffDays <= 13) return 'Last week';
  if (diffDays <= 20) return '2 weeks ago';
  if (diffDays <= 27) return '3 weeks ago';
  if (diffDays <= 59) return 'Last month';
  if (diffDays <= 89) return '2 months ago';
  if (diffDays <= 119) return '3 months ago';
  if (diffDays <= 364) return 'Within a year';

  return 'More than a year ago';
};

export type ChatSection = [string, Chat[]];

export const buildChatSections = (
  chats: Chat[],
  query: string,
  now: number
): ChatSection[] => {
  const nowDate = new Date(now);
  const sorted = [...chats].sort((a, b) => b.lastUsed - a.lastUsed);
  const matching = query
    ? sorted.filter((chat) => chatLabel(chat).toLowerCase().includes(query))
    : sorted;

  const sections: Record<string, Chat[]> = {};
  matching.forEach((chat) => {
    const section = getRelativeDateSection(new Date(chat.lastUsed), nowDate);
    if (!sections[section]) sections[section] = [];
    sections[section].push(chat);
  });

  return Object.entries(sections);
};
