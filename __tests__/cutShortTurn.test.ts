import { endsTurnCutShort } from '../components/chat-screen/cutShortTurn';
import type { Message } from '../database/chatRepository';

const message = (fields: Partial<Message>): Message => ({
  id: 1,
  chatId: 1,
  timestamp: 0,
  role: 'user',
  content: '',
  ...fields,
});

describe('where the cut-short marker goes', () => {
  it('sits under a question that got no answer', () => {
    const history = [message({ cutShortReason: 'memory' })];
    expect(endsTurnCutShort(history, 0)).toBe(true);
  });

  it('sits under the partial answer, not under its question as well', () => {
    const history = [
      message({ id: 1, cutShortReason: 'memory' }),
      message({ id: 2, role: 'assistant', cutShortReason: 'memory' }),
    ];
    expect(endsTurnCutShort(history, 0)).toBe(false);
    expect(endsTurnCutShort(history, 1)).toBe(true);
  });

  it('stays under an unanswered question once a later question follows', () => {
    const history = [
      message({ id: 1, cutShortReason: 'memory' }),
      message({ id: 2 }),
    ];
    expect(endsTurnCutShort(history, 0)).toBe(true);
    expect(endsTurnCutShort(history, 1)).toBe(false);
  });
});
