import { retrievalStatsLines } from '../utils/retrievalStatsLine';

describe('retrievalStatsLines', () => {
  it('says nothing for a turn that retrieved nothing', () => {
    expect(retrievalStatsLines(undefined)).toEqual([]);
    expect(retrievalStatsLines({})).toEqual([]);
  });

  it('reports the document leg on its own when the web was not searched', () => {
    expect(retrievalStatsLines({ rag: { ms: 412, chunks: 6 } })).toEqual([
      'rag: 412 ms, 6 chunks',
    ]);
  });

  it('reports the web leg on its own when no documents were attached', () => {
    expect(
      retrievalStatsLines({
        web: { ms: 8420, sources: 5, read: 3, queries: 2 },
      })
    ).toEqual(['web: 8420 ms, 5 sources, 3 read, 2 queries']);
  });

  it('puts the documents before the web, in the order they ran', () => {
    expect(
      retrievalStatsLines({
        rag: { ms: 100, chunks: 2 },
        web: { ms: 200, sources: 1, read: 1, queries: 1 },
      })
    ).toEqual([
      'rag: 100 ms, 2 chunks',
      'web: 200 ms, 1 source, 1 read, 1 query',
    ]);
  });

  it('keeps a leg that found nothing, so a slow empty search is still visible', () => {
    expect(
      retrievalStatsLines({
        rag: { ms: 900, chunks: 0 },
        web: { ms: 12000, sources: 0, read: 0, queries: 3 },
      })
    ).toEqual([
      'rag: 900 ms, 0 chunks',
      'web: 12000 ms, 0 sources, 0 read, 3 queries',
    ]);
  });
});
