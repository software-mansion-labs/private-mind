import {
  chatLabel,
  toChatTitle,
  MAX_CHAT_TITLE_LENGTH,
  firstLineOf,
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

  it('never ends a title inside a word', () => {
    const title = toChatTitle(
      'Can you explain how machine learning works in simple terms, and then give me a worked example'
    );

    expect(title).toBe(
      'Can you explain how machine learning works in simple terms, and then give me a'
    );
  });

  it('keeps the hard cut when one word runs past the cap on its own', () => {
    const word = 'x'.repeat(MAX_CHAT_TITLE_LENGTH + 20);

    expect(toChatTitle(word)).toHaveLength(MAX_CHAT_TITLE_LENGTH);
  });

  it('keeps the hard cut rather than throwing most of the title away', () => {
    const title = toChatTitle(`Rome ${'y'.repeat(MAX_CHAT_TITLE_LENGTH)}`);

    expect(title.length).toBeGreaterThan(MAX_CHAT_TITLE_LENGTH / 2);
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

describe('firstLineOf', () => {
  it('keeps the whole title when it fits on one line', () => {
    expect(firstLineOf([{ text: 'Short title' }], 'Short title')).toBe(
      'Short title'
    );
  });

  it('takes the words that fit, so the cut lands between them', () => {
    expect(
      firstLineOf(
        [{ text: 'Can you explain how machine ' }, { text: 'learning works' }],
        'Can you explain how machine learning works'
      )
    ).toBe('Can you explain how machine');
  });

  it('falls back to the title when the first line measured empty', () => {
    expect(firstLineOf([{ text: '' }, { text: 'x' }], 'Rivers')).toBe('Rivers');
  });
});
