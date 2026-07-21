import {
  buildChatSections,
  getRelativeDateSection,
  sortChatsByRecency,
} from '../components/drawer/chatSections';
import { Chat } from '../database/chatRepository';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-03-10T12:00:00Z').getTime();

const makeChat = (over: Partial<Chat>): Chat => ({
  id: 1,
  modelId: 1,
  title: 'Chat',
  lastUsed: NOW,
  ...over,
});

describe('getRelativeDateSection', () => {
  const now = new Date(NOW);

  it('labels the same day as Today', () => {
    expect(getRelativeDateSection(new Date(NOW - HOUR), now)).toBe('Today');
  });

  it('labels the previous day as Yesterday', () => {
    expect(getRelativeDateSection(new Date(NOW - DAY), now)).toBe('Yesterday');
  });

  it('labels 2-6 days back as "<n> days ago"', () => {
    expect(getRelativeDateSection(new Date(NOW - 2 * DAY), now)).toBe(
      '2 days ago'
    );
  });

  it('labels anything older than a year as "More than a year ago"', () => {
    expect(getRelativeDateSection(new Date(NOW - 400 * DAY), now)).toBe(
      'More than a year ago'
    );
  });
});

describe('sortChatsByRecency', () => {
  it('orders chats most-recent first without mutating the input', () => {
    const input = [
      makeChat({ id: 1, lastUsed: NOW - DAY }),
      makeChat({ id: 2, lastUsed: NOW - HOUR }),
      makeChat({ id: 3, lastUsed: NOW - 2 * DAY }),
    ];

    const sorted = sortChatsByRecency(input);

    expect(sorted.map((chat) => chat.id)).toEqual([2, 1, 3]);
    expect(input.map((chat) => chat.id)).toEqual([1, 2, 3]);
  });
});

describe('buildChatSections', () => {
  const chats = [
    makeChat({ id: 1, title: 'Pizza recipe', lastUsed: NOW - HOUR }),
    makeChat({ id: 2, title: 'Meeting notes', lastUsed: NOW - 2 * HOUR }),
    makeChat({ id: 3, title: 'Trip to Rome', lastUsed: NOW - DAY }),
  ];

  it('groups pre-sorted chats by their relative date section', () => {
    const sections = buildChatSections(chats, '', NOW);

    expect(sections).toEqual([
      ['Today', [chats[0], chats[1]]],
      ['Yesterday', [chats[2]]],
    ]);
  });

  it('filters by a case-insensitive label match', () => {
    const sections = buildChatSections(chats, 'rome', NOW);

    expect(sections).toEqual([['Yesterday', [chats[2]]]]);
  });

  it('matches the "Chat <id>" fallback label of untitled chats', () => {
    const untitled = makeChat({ id: 42, title: '', lastUsed: NOW - HOUR });

    const sections = buildChatSections([untitled], 'chat 42', NOW);

    expect(sections).toEqual([['Today', [untitled]]]);
  });

  it('returns no sections when nothing matches', () => {
    expect(buildChatSections(chats, 'nonexistent', NOW)).toEqual([]);
  });
});
