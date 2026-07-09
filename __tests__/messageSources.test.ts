import {
  assembleSourceDocuments,
  mergeAttachmentFirst,
  pickCitationsByAnswer,
  restrictCitationsToContext,
  type SourceRow,
} from '../utils/messageSources';
import { SourceDocument } from '../database/chatRepository';
import { formatContextChunks } from '../utils/contextUtils';

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

describe('assembleSourceDocuments', () => {
  const source = (id: number, name: string, firstChunk?: string): SourceRow => ({
    id,
    name,
    firstChunk,
  });

  it('returns the merged citations when retrieval produced sources', () => {
    const retrieved = [doc(1, 'old.pdf'), doc(2, 'attachment.txt')];
    const result = assembleSourceDocuments(
      retrieved,
      [doc(2, 'attachment.txt')],
      [2],
      [source(1, 'old.pdf'), source(2, 'attachment.txt')],
      true
    );

    expect(result.map((d) => d.documentId)).toEqual([2, 1]);
  });

  it('links the active document when context was sent but nothing was cited', () => {
    const result = assembleSourceDocuments(
      [],
      [],
      [],
      [source(9, 'report.pdf', 'overview text')],
      true
    );

    expect(result).toEqual([
      { documentId: 9, name: 'report.pdf', passage: 'overview text' },
    ]);
  });

  it('stays empty when no context reached the model', () => {
    const result = assembleSourceDocuments(
      [],
      [],
      [],
      [source(9, 'report.pdf', 'overview text')],
      false
    );

    expect(result).toEqual([]);
  });
});

describe('restrictCitationsToContext', () => {
  const cite = (documentId: number, name: string): SourceDocument => ({
    documentId,
    name,
  });
  const block = (documentId: number, name: string, document: string) => ({
    document,
    similarity: 0.8,
    metadata: { documentId, name },
  });

  it('drops documents whose block was truncated out of the prompt', () => {
    const cited = [
      cite(21, 'polityka_urlopowa_2026.pdf'),
      cite(20, 'sample.htm'),
      cite(19, '_10-K-2025-As-Filed.pdf'),
    ];
    const prompt = formatContextChunks([
      block(21, 'polityka_urlopowa_2026.pdf', 'vacation'),
    ]).join(' ');

    const result = restrictCitationsToContext(cited, prompt, [
      doc(21, 'polityka_urlopowa_2026.pdf'),
    ]);

    expect(result.map((d) => d.documentId)).toEqual([21]);
  });

  it('keeps every document whose block survived', () => {
    const cited = [cite(1, 'a.pdf'), cite(2, 'b.pdf')];
    const prompt = formatContextChunks([
      block(1, 'a.pdf', 'x'),
      block(2, 'b.pdf', 'y'),
    ]).join(' ');

    const result = restrictCitationsToContext(cited, prompt, []);

    expect(result.map((d) => d.documentId)).toEqual([1, 2]);
  });

  it('keeps the leading citation when nothing matched the prompt', () => {
    const cited = [cite(1, 'a.pdf'), cite(2, 'b.pdf')];

    const result = restrictCitationsToContext(cited, 'no headers here', []);

    expect(result.map((d) => d.documentId)).toEqual([1]);
  });

  it('passes through a single citation untouched', () => {
    const cited = [cite(1, 'a.pdf')];

    expect(restrictCitationsToContext(cited, '', [])).toEqual(cited);
  });
});

describe('pickCitationsByAnswer', () => {
  const withPassage = (
    documentId: number,
    name: string,
    passage: string
  ): SourceDocument => ({ documentId, name, passage });

  it('cites only the source the answer actually echoes', () => {
    const cited = [
      withPassage(22, 'sample.html', 'The quarterly revenue report and profit summary.'),
      withPassage(24, 'sample.csv', 'employee,vacation,days\nAnna,urlop,26'),
    ];
    const answer = 'Anna ma 26 dni urlopu według danych o pracownikach.';

    const result = pickCitationsByAnswer(cited, answer, []);

    expect(result.map((d) => d.documentId)).toEqual([24]);
  });

  it('keeps both sources when the answer draws on each', () => {
    const cited = [
      withPassage(1, 'revenue.txt', 'Total revenue grew to five million dollars.'),
      withPassage(2, 'headcount.txt', 'The company hired forty new engineers.'),
    ];
    const answer =
      'Revenue grew to five million dollars while the company hired forty engineers.';

    const result = pickCitationsByAnswer(cited, answer, []);

    expect(result.map((d) => d.documentId).sort()).toEqual([1, 2]);
  });

  it('never drops the freshly-attached source the answer does not echo', () => {
    const cited = [
      withPassage(1, 'other.txt', 'Revenue grew to five million dollars.'),
      withPassage(2, 'attachment.txt', 'Completely unrelated attached content.'),
    ];
    const answer = 'Revenue grew to five million dollars.';

    const result = pickCitationsByAnswer(cited, answer, [
      doc(2, 'attachment.txt'),
    ]);

    expect(result.map((d) => d.documentId).sort()).toEqual([1, 2]);
  });

  it('leaves the list unchanged when the answer echoes no passage', () => {
    const cited = [
      withPassage(1, 'a.txt', 'alpha beta gamma'),
      withPassage(2, 'b.txt', 'delta epsilon zeta'),
    ];

    const result = pickCitationsByAnswer(cited, "I don't know.", []);

    expect(result.map((d) => d.documentId)).toEqual([1, 2]);
  });

  it('passes through a single citation untouched', () => {
    const cited = [withPassage(1, 'a.txt', 'alpha beta gamma')];

    expect(pickCitationsByAnswer(cited, 'anything at all', [])).toEqual(cited);
  });
});
