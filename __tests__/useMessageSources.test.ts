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

  it('keeps a web source out of document sources unless it was used', () => {
    const r = render([
      doc({ documentId: 1, name: 'Unused', kind: 'web' }),
      doc({ documentId: 2, name: 'Used', kind: 'web', used: true }),
    ]);
    expect(r.webResults.map((s) => s.name)).toEqual(['Unused', 'Used']);
    expect(r.documentSources.map((s) => s.name)).toEqual(['Used']);
  });
});
