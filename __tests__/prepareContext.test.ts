import {
  formatContextChunks,
  formatFirstChunks,
  getSourceDocumentsFromChunks,
} from '../utils/contextUtils';

describe('formatContextChunks / getSourceDocumentsFromChunks', () => {
  const makeChunk = (
    document: string,
    similarity: number,
    documentId: number,
    name?: string
  ) => ({
    document,
    similarity,
    metadata: { documentId, ...(name ? { name } : {}) },
  });

  it('returns empty output for no chunks', () => {
    expect(formatContextChunks([])).toEqual([]);
    expect(getSourceDocumentsFromChunks([])).toEqual([]);
  });

  it('does not leak the relevance score into the LLM context', () => {
    const chunks = [makeChunk('Content', 0.85, 1)];
    const result = formatContextChunks(chunks);
    expect(result[0]).toContain('Content');
    expect(result[0]).not.toMatch(/%|Relevance/);
  });

  it('stitches adjacent passages without re-printing their shared overlap', () => {
    const chunks = [
      makeChunk(
        'The quarterly revenue report shows a total of 1200 units sold in Q3.',
        0.9,
        1,
        'report.pdf'
      ),
      makeChunk(
        'a total of 1200 units sold in Q3. The following section covers Q4 projections.',
        0.85,
        1,
        'report.pdf'
      ),
    ];
    const [source] = getSourceDocumentsFromChunks(chunks);
    const passage = source.passage!;

    expect(passage.split('a total of 1200 units sold in Q3')).toHaveLength(2);
    expect(passage).toContain('The following section covers Q4 projections');
  });

  it('leaves non-overlapping passages fully intact', () => {
    const chunks = [
      makeChunk('completely distinct first passage', 0.9, 1, 'doc.pdf'),
      makeChunk('an entirely separate second passage', 0.8, 1, 'doc.pdf'),
    ];
    const [source] = getSourceDocumentsFromChunks(chunks);

    expect(source.passage).toContain('completely distinct first passage');
    expect(source.passage).toContain('an entirely separate second passage');
  });

  it('groups chunks of one document into a single source, preserving input order', () => {
    const chunks = [
      makeChunk('a-1', 0.9, 1, 'doc-a.pdf'),
      makeChunk('a-2', 0.85, 1, 'doc-a.pdf'),
      makeChunk('b-1', 0.8, 2, 'doc-b.pdf'),
    ];
    const context = formatContextChunks(chunks);
    const sources = getSourceDocumentsFromChunks(chunks);

    expect(sources).toHaveLength(2);
    expect(sources[0].name).toBe('doc-a.pdf');
    expect(sources[1].name).toBe('doc-b.pdf');
    expect(context[0]).toContain('Source 1');
    expect(context[0]).toContain(sources[0].name);
    expect(context[1]).toContain('Source 2');
    expect(context[1]).toContain(sources[1].name);
    expect(context[0]).toContain('a-1');
    expect(context[0]).toContain('a-2');
    expect(sources[0].passage).toContain('a-1');
    expect(sources[0].passage).toContain('a-2');
    expect(sources[0].similarity).toBe(0.9);
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

  it('supports a custom source label for current attachments', () => {
    const result = formatFirstChunks(
      [{ id: 1, name: 'latest.pdf', firstChunk: 'Fresh context' }],
      'Current Attachment Source'
    );

    expect(result[0]).toContain('Current Attachment Source: latest.pdf');
    expect(result[0]).toContain('End of Current Attachment Source');
  });
});
