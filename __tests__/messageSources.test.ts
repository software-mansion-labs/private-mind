import { mergeAttachmentFirst } from '../utils/messageSources';
import { SourceDocument } from '../database/chatRepository';

const doc = (documentId: number | undefined, name: string): SourceDocument => ({
  documentId,
  name,
});

describe('mergeAttachmentFirst', () => {
  it('leads with retrieved attachment docs, then the rest', () => {
    const retrieved = [doc(1, 'old.pdf'), doc(2, 'attachment.txt')];
    const result = mergeAttachmentFirst(
      retrieved,
      [doc(2, 'attachment.txt')],
      [2]
    );

    expect(result.map((d) => d.documentId)).toEqual([2, 1]);
  });

  it('cites an attachment that produced no retrieved chunk, using its overview', () => {
    const retrieved = [doc(1, 'old.pdf')];
    const preferred = [doc(2, 'attachment.txt')];
    const result = mergeAttachmentFirst(retrieved, preferred, [2]);

    expect(result.map((d) => d.documentId)).toEqual([2, 1]);
    expect(result).toHaveLength(2);
  });

  it('does not duplicate an attachment that was both retrieved and preferred', () => {
    const retrieved = [doc(2, 'attachment.txt')];
    const preferred = [doc(2, 'attachment.txt')];
    const result = mergeAttachmentFirst(retrieved, preferred, [2]);

    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe(2);
  });

  it('does not collide two undefined-id sources onto one slot', () => {
    const retrieved = [doc(undefined, 'a.pdf'), doc(undefined, 'b.pdf')];
    const result = mergeAttachmentFirst(retrieved, [], [7]);

    expect(result).toHaveLength(2);
    expect(result.map((d) => d.name)).toEqual(['a.pdf', 'b.pdf']);
  });
});
