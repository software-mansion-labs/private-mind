import { cleanForSpeech, cutAtSentence } from '../utils/speechText';

describe('cleanForSpeech', () => {
  it('returns nothing for empty input', () => {
    expect(cleanForSpeech('')).toBe('');
  });

  it('removes bold, italic and strikethrough markers but keeps the words', () => {
    expect(cleanForSpeech('This is **very** _important_ and ~~wrong~~.')).toBe(
      'This is very important and wrong.'
    );
  });

  it('keeps underscores inside identifiers', () => {
    expect(cleanForSpeech('Call my_var_name now.')).toBe(
      'Call my_var_name now.'
    );
  });

  it('keeps arithmetic asterisks', () => {
    expect(cleanForSpeech('2 * 3 * 4 is 24.')).toBe('2 * 3 * 4 is 24.');
  });

  it('turns headings and list items into sentences', () => {
    const markdown = '# Plan\n\n- first step\n- second step\n1. third step';
    expect(cleanForSpeech(markdown)).toBe(
      'Plan. first step. second step. third step.'
    );
  });

  it('drops fenced code blocks entirely', () => {
    const markdown = 'Run this:\n```ts\nconst a = 1;\n```\nThen relax.';
    expect(cleanForSpeech(markdown)).toBe('Run this: Then relax.');
  });

  it('drops a code block that was never closed', () => {
    expect(cleanForSpeech('Before.\n```\nconst a = 1;')).toBe('Before.');
  });

  it('keeps the words of inline code without the backticks', () => {
    expect(cleanForSpeech('Use `useState` here.')).toBe('Use useState here.');
  });

  it('drops tables', () => {
    const markdown = 'Results:\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nDone.';
    expect(cleanForSpeech(markdown)).toBe('Results: Done.');
  });

  it('keeps link text and drops the address', () => {
    expect(cleanForSpeech('See [the docs](https://example.com/a) today.')).toBe(
      'See the docs today.'
    );
  });

  it('drops images and bare addresses', () => {
    expect(
      cleanForSpeech('Look ![chart](a.png) at https://example.com/x?y=1 now.')
    ).toBe('Look at now.');
  });

  it('drops citation badges', () => {
    expect(cleanForSpeech('The sky is blue [1]. Water is wet [2][3].')).toBe(
      'The sky is blue. Water is wet.'
    );
  });

  it('drops emoji including joined and flag sequences', () => {
    expect(
      cleanForSpeech('Great job \u{1F44D}\u{1F3FD} \u{1F1F5}\u{1F1F1} done ✨.')
    ).toBe('Great job done.');
  });

  it('drops thinking sections, closed or not', () => {
    expect(cleanForSpeech('<think>secret plan</think>The answer is 4.')).toBe(
      'The answer is 4.'
    );
    expect(cleanForSpeech('Answer.<think>still thinking')).toBe('Answer.');
  });

  it('drops blockquote markers and horizontal rules', () => {
    expect(cleanForSpeech('> quoted line\n\n---\n\nAfter.')).toBe(
      'quoted line. After.'
    );
  });

  it('strips html tags', () => {
    expect(cleanForSpeech('a<br>b <b>bold</b>')).toBe('ab bold.');
  });

  it('leaves non-latin text alone', () => {
    expect(cleanForSpeech('**Cześć** świecie, jak się masz?')).toBe(
      'Cześć świecie, jak się masz?'
    );
  });

  it('returns nothing when only code is left', () => {
    expect(cleanForSpeech('```\nonly code\n```')).toBe('');
  });

  it('caps long answers at a sentence boundary', () => {
    const sentence = 'This is a sentence. ';
    const spoken = cleanForSpeech(sentence.repeat(50), 100);
    expect(spoken.length).toBeLessThanOrEqual(100);
    expect(spoken.endsWith('sentence.')).toBe(true);
  });
});

describe('cutAtSentence', () => {
  it('leaves short text untouched', () => {
    expect(cutAtSentence('Short one.', 50)).toBe('Short one.');
  });

  it('falls back to a hard cut without any sentence end', () => {
    expect(cutAtSentence('abcdefghij', 4)).toBe('abcd');
  });
});
