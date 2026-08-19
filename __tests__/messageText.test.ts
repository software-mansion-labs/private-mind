import type { Message } from '../database/chatRepository';
import { visibleMessageText } from '../utils/messageText';
import { stripThinkBlocks, thinkBlocksText } from '../utils/thinking';

const message = (overrides: Partial<Message> = {}): Message =>
  ({
    id: 1,
    chatId: 1,
    role: 'assistant',
    content: '',
    timestamp: 0,
    ...overrides,
  }) as Message;

describe('stripThinkBlocks', () => {
  it('leaves a reply without a think block untouched', () => {
    expect(stripThinkBlocks('Plain answer')).toBe('Plain answer');
  });

  it('drops a closed block and keeps the text around it', () => {
    expect(stripThinkBlocks('before<think>hidden</think>after')).toBe(
      'beforeafter'
    );
  });

  it('keeps the original spacing of the answer', () => {
    expect(stripThinkBlocks('<think>hidden</think>\n\nThe answer.')).toBe(
      'The answer.'
    );
  });

  it('drops every block, not just the first', () => {
    expect(
      stripThinkBlocks('one <think>a</think>two <think>b</think>three')
    ).toBe('one two three');
  });

  it('drops an unterminated block and everything after it', () => {
    expect(stripThinkBlocks('visible<think>still reasoning')).toBe('visible');
  });
});

describe('thinkBlocksText', () => {
  it('returns the reasoning of a closed block', () => {
    expect(thinkBlocksText('<think>reasoning</think>answer')).toBe('reasoning');
  });

  it('returns the reasoning of an unterminated block', () => {
    expect(thinkBlocksText('<think>interrupted reasoning')).toBe(
      'interrupted reasoning'
    );
  });

  it('joins several blocks', () => {
    expect(thinkBlocksText('<think>a</think>x<think>b</think>')).toBe('a\n\nb');
  });

  it('returns an empty string when there is no block', () => {
    expect(thinkBlocksText('plain answer')).toBe('');
  });
});

describe('visibleMessageText', () => {
  it('strips the think block from an assistant reply', () => {
    const text = visibleMessageText(
      message({ content: '<think>long reasoning</think>The answer is 42.' })
    );

    expect(text).toBe('The answer is 42.');
  });

  it('strips an unterminated think block from an interrupted reply', () => {
    const text = visibleMessageText(
      message({ content: 'Partial answer.<think>reasoning cut off' })
    );

    expect(text).toBe('Partial answer.');
  });

  it('falls back to the reasoning when the reply is nothing but a think block', () => {
    const text = visibleMessageText(
      message({ content: '<think>reasoning cut off' })
    );

    expect(text).toBe('reasoning cut off');
  });

  it('strips [n] citation markers when the reply is grounded in sources', () => {
    const text = visibleMessageText(
      message({
        content: '<think>which file?</think>The total was 100 [1].',
        sourceDocuments: [{ documentId: 1, name: 'report.pdf' }],
      })
    );

    expect(text).toBe('The total was 100.');
  });

  it('keeps bracketed numbers when the reply has no sources', () => {
    const text = visibleMessageText(message({ content: 'See item [1].' }));

    expect(text).toBe('See item [1].');
  });

  it('copies a user message without think markers but keeps every word', () => {
    const content = 'Pytanie <think>notatka</think> dalej';

    expect(visibleMessageText(message({ role: 'user', content }))).toBe(
      'Pytanie notatka dalej'
    );
  });

  it('copies an assistant reply whose think block has no opening marker', () => {
    const content = 'model reasoning</think>The real answer.';

    expect(visibleMessageText(message({ content }))).toBe('The real answer.');
  });

  it('copies an assistant reply with several think blocks, markers included', () => {
    const content = 'a<think>x</think>b<think>y</think>c';

    expect(visibleMessageText(message({ content }))).toBe('abc');
  });
});
