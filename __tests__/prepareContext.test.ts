import { filterAndFormatContext, formatFirstChunks } from '../utils/contextUtils';

describe('filterAndFormatContext', () => {
  const makeChunk = (
    document: string,
    similarity: number,
    documentId: number
  ) => ({
    document,
    similarity,
    metadata: { documentId },
  });

  it('includes chunks above 0.3 similarity threshold', () => {
    const chunks = [
      makeChunk('Relevant', 0.5, 1),
      makeChunk('Irrelevant', 0.2, 1),
    ];
    const result = filterAndFormatContext(chunks);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('Relevant');
  });

  it('limits to max 3 chunks', () => {
    const chunks = [
      makeChunk('High 1', 0.9, 1),
      makeChunk('High 2', 0.8, 1),
      makeChunk('High 3', 0.7, 1),
      makeChunk('High 4', 0.6, 1),
    ];
    const result = filterAndFormatContext(chunks);
    expect(result).toHaveLength(3);
  });

  it('returns empty array for no chunks', () => {
    expect(filterAndFormatContext([])).toEqual([]);
  });

  it('returns empty when all below threshold', () => {
    const chunks = [
      makeChunk('Low 1', 0.2, 1),
      makeChunk('Low 2', 0.1, 1),
    ];
    expect(filterAndFormatContext(chunks)).toEqual([]);
  });

  it('includes relevance score in formatted output', () => {
    const chunks = [makeChunk('Content', 0.85, 1)];
    const result = filterAndFormatContext(chunks);
    expect(result[0]).toContain('85.0%');
  });

  it('sorts by similarity descending', () => {
    const chunks = [
      makeChunk('Low', 0.6, 1),
      makeChunk('High', 0.9, 1),
      makeChunk('Mid', 0.75, 1),
    ];
    const result = filterAndFormatContext(chunks);
    expect(result[0]).toContain('High');
    expect(result[1]).toContain('Mid');
    expect(result[2]).toContain('Low');
  });
});

describe('formatFirstChunks', () => {
  it('formats first chunks with source name', () => {
    const sources = [
      { id: 1, name: 'report.pdf', firstChunk: 'This is the introduction.' },
    ];
    const result = formatFirstChunks(sources);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('report.pdf');
    expect(result[0]).toContain('This is the introduction.');
    expect(result[0]).toContain('Overview');
  });

  it('handles multiple sources', () => {
    const sources = [
      { id: 1, name: 'doc1.pdf', firstChunk: 'Doc 1 intro' },
      { id: 2, name: 'doc2.pdf', firstChunk: 'Doc 2 intro' },
    ];
    const result = formatFirstChunks(sources);
    expect(result).toHaveLength(2);
  });

  it('skips sources without firstChunk', () => {
    const sources = [
      { id: 1, name: 'doc.pdf', firstChunk: undefined },
      { id: 2, name: 'doc2.pdf', firstChunk: 'Has intro' },
    ];
    const result = formatFirstChunks(sources);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain('Has intro');
  });

  it('returns empty for empty input', () => {
    expect(formatFirstChunks([])).toEqual([]);
  });
});
