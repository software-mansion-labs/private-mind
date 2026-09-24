import { stripSpecialTokens } from '../utils/specialTokens';

describe('stripSpecialTokens', () => {
  it('removes the reserved placeholders reported in #342', () => {
    expect(
      stripSpecialTokens(
        'Office Environment:<unused6226><unused6226>感 (a feeling of focus).'
      )
    ).toBe('Office Environment:感 (a feeling of focus).');
  });

  it('removes a chat-template turn marker the model echoed', () => {
    expect(stripSpecialTokens('Done.<end_of_turn>')).toBe('Done.');
    expect(stripSpecialTokens('<start_of_turn>model\nHi')).toBe('model\nHi');
  });

  it('removes pipe-fenced markers whatever the name inside', () => {
    expect(stripSpecialTokens('Answer<|im_end|>')).toBe('Answer');
    expect(stripSpecialTokens('<|begin_of_sentence|>Hello')).toBe('Hello');
  });

  it('removes byte-fallback and indexed placeholders from other tokenizers', () => {
    expect(stripSpecialTokens('a<0x0A>b')).toBe('ab');
    expect(stripSpecialTokens('a<extra_id_7>b')).toBe('ab');
    expect(stripSpecialTokens('a<reserved_special_token_12>b')).toBe('ab');
  });

  it('leaves one space where the marker separated two words', () => {
    expect(stripSpecialTokens('the answer <eos> is here')).toBe(
      'the answer is here'
    );
  });

  it('does not leave a gap before punctuation', () => {
    expect(stripSpecialTokens('the answer <eos>.')).toBe('the answer.');
  });

  it('strips every token Gemma 4 VL declares in its tokenizer config', () => {
    const declared = [
      '<pad>',
      '<eos>',
      '<bos>',
      '<unk>',
      '<mask>',
      '<|tool>',
      '<tool|>',
      '<|tool_call>',
      '<tool_call|>',
      '<|tool_response>',
      '<tool_response|>',
      '<|\"|>',
      '<|think|>',
      '<|channel>',
      '<channel|>',
      '<|turn>',
      '<turn|>',
      '<|image>',
      '<|audio>',
      '<|image|>',
      '<|audio|>',
      '<image|>',
      '<audio|>',
      '<|video|>',
    ];

    for (const token of declared) {
      expect(stripSpecialTokens(`before${token}after`)).toBe('beforeafter');
    }
  });

  it('leaves thinking markers alone, because they are parsed elsewhere', () => {
    const text = '<think>reasoning</think>answer';
    expect(stripSpecialTokens(text)).toBe(text);
  });

  it('leaves markup that a reader legitimately writes', () => {
    const text = 'Use <h1> for a heading, and <s>struck</s> for strikethrough.';
    expect(stripSpecialTokens(text)).toBe(text);
  });

  it('leaves a marker the answer is explaining inside code', () => {
    const inline = 'The `<eos>` token ends a sequence.';
    expect(stripSpecialTokens(inline)).toBe(inline);

    const fenced = 'Example:\n```\n<|im_start|>user\n```\ndone';
    expect(stripSpecialTokens(fenced)).toBe(fenced);
  });

  it('strips outside a code span while preserving the span itself', () => {
    expect(stripSpecialTokens('<eos> see `<eos>` here <eos>')).toBe(
      'see `<eos>` here'
    );
  });

  it('does not disturb indentation of a list it had to clean', () => {
    expect(stripSpecialTokens('- one<eos>\n  - nested\n  - items')).toBe(
      '- one\n  - nested\n  - items'
    );
  });

  it('returns the same string when there is nothing to strip', () => {
    const text = 'A perfectly ordinary answer.';
    expect(stripSpecialTokens(text)).toBe(text);
    expect(stripSpecialTokens('')).toBe('');
  });

  it('answers the same way on repeated calls, whatever the regex state', () => {
    const text = 'a<unused1>b<unused2>c';
    expect(stripSpecialTokens(text)).toBe('abc');
    expect(stripSpecialTokens(text)).toBe('abc');
    expect(stripSpecialTokens(text)).toBe('abc');
  });
});
