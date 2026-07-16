import { chatLabel } from '../utils/chatLabel';

describe('chatLabel', () => {
  it('returns the title when the chat has one', () => {
    expect(chatLabel({ id: 3, title: 'Trip to Rome' })).toBe('Trip to Rome');
  });

  it('falls back to "Chat <id>" for an empty title', () => {
    expect(chatLabel({ id: 9, title: '' })).toBe('Chat 9');
  });
});
