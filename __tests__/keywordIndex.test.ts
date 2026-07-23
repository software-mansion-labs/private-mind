import {
  buildKeywordMatchExpression,
  ensureKeywordIndex,
  foldForKeywordIndex,
} from '../database/keywordIndex';
import type { DB } from '@op-engineering/op-sqlite';

type ExecCall = { sql: string; params?: unknown[] };

const makeDb = (opts: {
  count?: number;
  vectors?: Record<string, unknown>[];
  vectorsThrows?: boolean;
}) => {
  const calls: ExecCall[] = [];
  const execute = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('COUNT(*)')) return { rows: [{ n: opts.count ?? 0 }] };
    if (sql.includes('FROM vectors')) {
      if (opts.vectorsThrows) throw new Error('no such table: vectors');
      return { rows: opts.vectors ?? [] };
    }
    return { rows: [] };
  });
  return { db: { execute } as unknown as DB, calls };
};

describe('foldForKeywordIndex', () => {
  it('folds the Polish stroke letter ł/Ł to l/L (leaving other letters intact)', () => {
    expect(foldForKeywordIndex('płatność')).toBe('platność');
    expect(foldForKeywordIndex('usługę')).toBe('uslugę');
    expect(foldForKeywordIndex('Łódź')).toBe('Lódź');
  });

  it('leaves decomposable diacritics for the FTS tokenizer to fold', () => {
    expect(foldForKeywordIndex('księgową')).toBe('księgową');
  });

  it('leaves plain ASCII untouched', () => {
    expect(foldForKeywordIndex('invoice E4021')).toBe('invoice E4021');
  });
});

describe('buildKeywordMatchExpression', () => {
  it('prefix-matches the stem of an inflected word so "pliku" finds "plików"', () => {
    expect(buildKeywordMatchExpression(['pliku'])).toBe('"plik"*');
    expect(buildKeywordMatchExpression(['plików'])).toBe('"plik"*');
  });

  it('folds ł in terms and prefix-matches the stem', () => {
    expect(buildKeywordMatchExpression(['płatność'])).toBe('"platno"*');
  });

  it('OR-joins the stemmed terms', () => {
    expect(buildKeywordMatchExpression(['invoice', 'total'])).toBe(
      '"invoi"* OR "tota"*'
    );
  });

  it('matches identifiers exactly (no stemming, no prefix)', () => {
    expect(buildKeywordMatchExpression(['219039'])).toBe('"219039"');
    expect(buildKeywordMatchExpression(['e-4021'])).toBe('"e-4021"');
  });

  it('quotes terms so FTS5 operators are treated as literals', () => {
    expect(buildKeywordMatchExpression(['e-4021', 'OR'])).toBe(
      '"e-4021" OR "OR"'
    );
  });

  it('escapes embedded double quotes by doubling them', () => {
    expect(buildKeywordMatchExpression(['22"'])).toBe('"22"""');
  });

  it('drops blank terms', () => {
    expect(buildKeywordMatchExpression(['  ', 'ok'])).toBe('"ok"');
  });

  it('returns null when there is nothing to search', () => {
    expect(buildKeywordMatchExpression([])).toBeNull();
    expect(buildKeywordMatchExpression(['   '])).toBeNull();
  });
});

describe('ensureKeywordIndex backfill', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('backfills the index from existing vectors when it is empty', async () => {
    const { db, calls } = makeDb({
      count: 0,
      vectors: [
        {
          id: '1:0',
          document: 'Hello płatność',
          metadata: JSON.stringify({ documentId: 1 }),
        },
        {
          id: '2:3',
          document: 'World',
          metadata: JSON.stringify({ documentId: 2 }),
        },
      ],
    });

    const ok = await ensureKeywordIndex(db);
    expect(ok).toBe(true);

    const inserts = calls.filter((c) => c.sql.startsWith('INSERT INTO'));
    expect(inserts).toHaveLength(2);
    expect(inserts[0].params).toEqual(['1:0', 1, 'Hello platność']);
    expect(inserts[1].params).toEqual(['2:3', 2, 'World']);
    expect(calls.some((c) => c.sql === 'BEGIN')).toBe(true);
    expect(calls.some((c) => c.sql === 'COMMIT')).toBe(true);
  });

  it('indexes only the chunks the index is missing, not just the empty case', async () => {
    const { db, calls } = makeDb({
      count: 7,
      vectors: [
        {
          id: '9:1',
          document: 'never indexed',
          metadata: JSON.stringify({ documentId: 9 }),
        },
      ],
    });

    await ensureKeywordIndex(db);

    const vectorQuery = calls.find((c) => c.sql.includes('FROM vectors'));
    expect(vectorQuery?.sql).toContain('NOT IN (SELECT chunk_id');

    const inserts = calls.filter((c) => c.sql.startsWith('INSERT INTO'));
    expect(inserts).toHaveLength(1);
    expect(inserts[0].params).toEqual(['9:1', 9, 'never indexed']);
  });

  it('inserts nothing when no chunk is missing from the index', async () => {
    const { db, calls } = makeDb({ count: 7, vectors: [] });

    await ensureKeywordIndex(db);

    expect(calls.some((c) => c.sql.startsWith('INSERT INTO'))).toBe(false);
  });

  it('stays available when there is no vector table to backfill from', async () => {
    const { db, calls } = makeDb({ count: 0, vectorsThrows: true });

    const ok = await ensureKeywordIndex(db);

    expect(ok).toBe(true);
    expect(calls.some((c) => c.sql.startsWith('INSERT INTO'))).toBe(false);
  });

  it('skips chunks with no document or unparseable document id', async () => {
    const { db, calls } = makeDb({
      count: 0,
      vectors: [
        {
          id: '1:0',
          document: '',
          metadata: JSON.stringify({ documentId: 1 }),
        },
        { id: '2:0', document: 'kept', metadata: JSON.stringify({}) },
        {
          id: '3:0',
          document: 'indexed',
          metadata: JSON.stringify({ documentId: 3 }),
        },
      ],
    });

    await ensureKeywordIndex(db);

    const inserts = calls.filter((c) => c.sql.startsWith('INSERT INTO'));
    expect(inserts).toHaveLength(1);
    expect(inserts[0].params).toEqual(['3:0', 3, 'indexed']);
  });
});
