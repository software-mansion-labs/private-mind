import { chatPredatesSourceLinking } from '../utils/legacyChat';
import { setSourceLinkingBoundary } from '../utils/sourceLinkingBoundary';
import { Message } from '../database/chatRepository';

const BOUNDARY = 200;

const message = (overrides: Partial<Message>): Message => ({
  id: 1,
  chatId: 7,
  role: 'user',
  content: 'hi',
  timestamp: 0,
  ...overrides,
});

describe('chatPredatesSourceLinking', () => {
  it('returns false for a chat with no attached documents', () => {
    expect(
      chatPredatesSourceLinking(
        [
          message({ role: 'user', content: 'hello' }),
          message({ id: 2, role: 'assistant', content: 'hi there' }),
        ],
        BOUNDARY
      )
    ).toBe(false);
  });

  it('flags a legacy chat that attached a document but has no source linking', () => {
    expect(
      chatPredatesSourceLinking(
        [
          message({ id: 10, role: 'user', documentName: 'report.pdf' }),
          message({ id: 11, role: 'assistant', content: 'summary' }),
        ],
        BOUNDARY
      )
    ).toBe(true);
  });

  it('does not flag a chat where the document is linked via sourceDocuments', () => {
    expect(
      chatPredatesSourceLinking(
        [
          message({ id: 10, role: 'user', documentName: 'report.pdf' }),
          message({
            id: 11,
            role: 'assistant',
            content: 'summary [1]',
            sourceDocuments: [{ name: 'report.pdf', documentId: 3 }],
          }),
        ],
        BOUNDARY
      )
    ).toBe(false);
  });

  it('keeps flagging a legacy chat after a new-era turn retrieves a source', () => {
    expect(
      chatPredatesSourceLinking(
        [
          message({ id: 10, role: 'user', documentName: 'report.pdf' }),
          message({ id: 11, role: 'assistant', content: 'summary' }),
          message({ id: 204, role: 'user', documentName: 'other.pdf' }),
          message({
            id: 205,
            role: 'assistant',
            content: 'answer [1]',
            sourceDocuments: [{ name: 'other.pdf', documentId: 9 }],
          }),
        ],
        BOUNDARY
      )
    ).toBe(true);
  });

  it('does NOT flag a new-era chat whose upload was interrupted before sourceDocuments', () => {
    expect(
      chatPredatesSourceLinking(
        [
          message({ id: 201, role: 'user', documentName: 'report.pdf' }),
          message({ id: 202, role: 'assistant', content: '' }),
        ],
        BOUNDARY
      )
    ).toBe(false);
  });

  it('treats an empty sourceDocuments array as no linking (legacy id)', () => {
    expect(
      chatPredatesSourceLinking(
        [
          message({ id: 10, role: 'user', documentName: 'report.pdf' }),
          message({ id: 11, role: 'assistant', sourceDocuments: [] }),
        ],
        BOUNDARY
      )
    ).toBe(true);
  });

  it('returns false for an empty conversation', () => {
    expect(chatPredatesSourceLinking([], BOUNDARY)).toBe(false);
  });

  it('reads the module boundary when none is passed', () => {
    setSourceLinkingBoundary(BOUNDARY);
    expect(
      chatPredatesSourceLinking([
        message({ id: 10, role: 'user', documentName: 'report.pdf' }),
        message({ id: 11, role: 'assistant', content: 'summary' }),
      ])
    ).toBe(true);
    setSourceLinkingBoundary(0);
  });

  it('flags nothing when the boundary is 0 (fresh install / not yet loaded)', () => {
    expect(
      chatPredatesSourceLinking(
        [message({ id: 10, role: 'user', documentName: 'report.pdf' })],
        0
      )
    ).toBe(false);
  });
});
