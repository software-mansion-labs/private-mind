import { renderHook } from '@testing-library/react-native';
import { useMessageSources } from '../hooks/useMessageSources';
import { type SourceDocument } from '../database/chatRepository';

const doc = (over: Partial<SourceDocument> = {}): SourceDocument => ({
  name: 'Doc',
  ...over,
});

const render = (sources?: SourceDocument[]) =>
  renderHook(() => useMessageSources(sources)).result.current;

describe('useMessageSources', () => {
  it('returns everything empty when there are no sources', () => {
    const r = render(undefined);
    expect(r.displayedSources).toEqual([]);
    expect(r.webResults).toEqual([]);
    expect(r.documentSources).toEqual([]);
    expect(r.hasSources).toBe(false);
  });

  it('dedupes by document id and name, keeping the first', () => {
    const r = render([
      doc({ documentId: 1, name: 'A' }),
      doc({ documentId: 1, name: 'A' }),
      doc({ documentId: 2, name: 'A' }),
    ]);
    expect(r.displayedSources).toHaveLength(2);
    expect(r.hasSources).toBe(true);
  });

  it('splits web results from document sources', () => {
    const r = render([
      doc({ documentId: 1, name: 'Web', kind: 'web' }),
      doc({ documentId: 2, name: 'PDF' }),
    ]);
    expect(r.webResults.map((s) => s.name)).toEqual(['Web']);
    expect(r.documentSources.map((s) => s.name)).toEqual(['PDF']);
  });

  it('shows a web source whose read flag was never set', () => {
    const r = render([doc({ name: 'Web', kind: 'web', url: 'https://a.com' })]);
    expect(r.displayedSources.map((s) => s.name)).toEqual(['Web']);
    expect(r.hasSources).toBe(true);
  });

  it('offers no unopened page as a source, but keeps it for the trace', () => {
    const r = render([
      doc({ name: 'Opened', kind: 'web', url: 'https://a.com', read: true }),
      doc({ name: 'Unopened', kind: 'web', url: 'https://b.com', read: false }),
    ]);
    expect(r.displayedSources.map((s) => s.name)).toEqual(['Opened']);
    expect(r.webResults.map((s) => s.name)).toEqual(['Opened', 'Unopened']);
  });

  it('excludes an unopened page even when its listing grounded the answer', () => {
    const r = render([
      doc({
        name: 'Listing',
        kind: 'web',
        url: 'https://a.com',
        read: false,
        used: true,
      }),
    ]);
    expect(r.displayedSources).toEqual([]);
  });

  it('keeps a web source out of document sources unless it was used', () => {
    const r = render([
      doc({ documentId: 1, name: 'Unused', kind: 'web' }),
      doc({ documentId: 2, name: 'Used', kind: 'web', used: true }),
    ]);
    expect(r.webResults.map((s) => s.name)).toEqual(['Unused', 'Used']);
    expect(r.documentSources.map((s) => s.name)).toEqual(['Used']);
  });

  describe('dominantWebSource', () => {
    it('names the single used web source', () => {
      const r = render([
        doc({ documentId: 1, name: 'CoinMarketCap', kind: 'web', used: true }),
        doc({ documentId: 2, name: 'Unused', kind: 'web' }),
      ]);
      expect(r.dominantWebSource?.name).toBe('CoinMarketCap');
    });

    it('is undefined when no web source was used', () => {
      const r = render([
        doc({ documentId: 1, name: 'A', kind: 'web' }),
        doc({ documentId: 2, name: 'B', kind: 'web' }),
      ]);
      expect(r.dominantWebSource).toBeUndefined();
    });

    it('is undefined when several web sources were used, deferring to "the sources"', () => {
      const r = render([
        doc({ documentId: 1, name: 'A', kind: 'web', used: true }),
        doc({ documentId: 2, name: 'B', kind: 'web', used: true }),
      ]);
      expect(r.dominantWebSource).toBeUndefined();
    });

    it('ignores a used document source', () => {
      const r = render([doc({ documentId: 1, name: 'PDF', used: true })]);
      expect(r.dominantWebSource).toBeUndefined();
    });
  });
});
