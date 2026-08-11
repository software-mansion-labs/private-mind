import {
  chatLabel,
  toChatTitle,
  MAX_CHAT_TITLE_LENGTH,
} from '../utils/chatLabel';

describe('toChatTitle', () => {
  it('keeps a title that fits', () => {
    expect(toChatTitle('What is photosynthesis?')).toBe(
      'What is photosynthesis?'
    );
  });

  it('collapses the whitespace of a multi-line message', () => {
    expect(toChatTitle('  Explain\n\nthis   code  ')).toBe('Explain this code');
  });

  it('caps a long message without marking the cut', () => {
    const title = toChatTitle('a '.repeat(200));

    expect(title.length).toBeLessThanOrEqual(MAX_CHAT_TITLE_LENGTH);
    expect(title.endsWith('...')).toBe(false);
    expect(title.endsWith(' ')).toBe(false);
  });

  it('leaves room for far more than a drawer row shows', () => {
    expect(MAX_CHAT_TITLE_LENGTH).toBeGreaterThan(25);
  });
});

describe('chatLabel', () => {
  it('returns the title when the chat has one', () => {
    expect(chatLabel({ id: 3, title: 'Trip to Rome' })).toBe('Trip to Rome');
  });

  it('falls back to "Chat <id>" for an empty title', () => {
    expect(chatLabel({ id: 9, title: '' })).toBe('Chat 9');
  });
});
