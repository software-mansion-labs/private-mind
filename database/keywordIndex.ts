import { type DB, type Scalar } from '@op-engineering/op-sqlite';
import { stemPrefix } from '../utils/queryTerms';
import { KEYWORD_TABLE, FTS_TOKENIZER } from '../constants/keyword-index';

// FTS5 keyword index paralleling the vector store's chunks (same op-sqlite DB,
// same chunk id) for BM25 retrieval. FTS5 depends on the native build; when it's
// absent every op below no-ops and hybrid search degrades to vector-only. ł/Ł is
// folded by hand because the tokenizer's remove_diacritics leaves that stroke
// letter alone, so "platnosc" would otherwise never match "płatność".

export const foldForKeywordIndex = (text: string): string =>
  text.replace(/Ł/g, 'L').replace(/ł/g, 'l');

let ftsAvailable = false;

export const isKeywordIndexAvailable = (): boolean => ftsAvailable;

export const ensureKeywordIndex = async (db: DB): Promise<boolean> => {
  try {
    await db.execute(
      `CREATE VIRTUAL TABLE IF NOT EXISTS ${KEYWORD_TABLE} USING fts5(
        chunk_id UNINDEXED,
        document_id UNINDEXED,
        content,
        tokenize = '${FTS_TOKENIZER}'
      );`
    );
    ftsAvailable = true;
  } catch (error) {
    console.warn(
      'FTS5 keyword index unavailable; hybrid search falls back to vector-only',
      error
    );
    ftsAvailable = false;
  }

  return ftsAvailable;
};

export const addChunkToKeywordIndex = async (
  db: DB,
  chunkId: string,
  documentId: number,
  content: string
): Promise<void> => {
  if (!ftsAvailable) return;

  try {
    await db.execute(
      `INSERT INTO ${KEYWORD_TABLE} (chunk_id, document_id, content) VALUES (?, ?, ?)`,
      [chunkId, documentId, foldForKeywordIndex(content)]
    );
  } catch (error) {
    console.warn('Failed to index chunk for keyword search', {
      chunkId,
      documentId,
      error,
    });
  }
};

export const removeDocumentFromKeywordIndex = async (
  db: DB,
  documentId: number
): Promise<void> => {
  if (!ftsAvailable) return;

  try {
    await db.execute(`DELETE FROM ${KEYWORD_TABLE} WHERE document_id = ?`, [
      documentId,
    ]);
  } catch (error) {
    console.warn('Failed to remove document from keyword index', {
      documentId,
      error,
    });
  }
};

export const dropKeywordIndex = async (db: DB): Promise<void> => {
  try {
    await db.execute(`DROP TABLE IF EXISTS ${KEYWORD_TABLE};`);
  } catch (error) {
    console.warn('Failed to drop keyword index', error);
  }
  ftsAvailable = false;
};

export const buildKeywordMatchExpression = (terms: string[]): string | null => {
  const tokens = new Set<string>();
  for (const term of terms) {
    const folded = foldForKeywordIndex(term.trim());
    if (!folded) continue;
    const stem = stemPrefix(folded);
    const escaped = stem.replace(/"/g, '""');
    tokens.add(stem === folded ? `"${escaped}"` : `"${escaped}"*`);
  }

  if (tokens.size === 0) return null;
  return [...tokens].join(' OR ');
};

export type KeywordHit = {
  chunkId: string;
  documentId?: number;
  score: number;
};

export const keywordSearch = async (
  db: DB,
  terms: string[],
  enabledDocumentIds: number[],
  limit: number
): Promise<KeywordHit[]> => {
  if (!ftsAvailable || enabledDocumentIds.length === 0) return [];

  const matchExpression = buildKeywordMatchExpression(terms);
  if (!matchExpression) return [];

  const placeholders = enabledDocumentIds.map(() => '?').join(', ');

  try {
    const result = await db.execute(
      `SELECT chunk_id AS chunkId, document_id AS documentId, bm25(${KEYWORD_TABLE}) AS score
       FROM ${KEYWORD_TABLE}
       WHERE ${KEYWORD_TABLE} MATCH ? AND document_id IN (${placeholders})
       ORDER BY score
       LIMIT ?`,
      [matchExpression, ...enabledDocumentIds, limit]
    );

    return result.rows.map((row: Record<string, Scalar>) => ({
      chunkId: String(row.chunkId),
      documentId:
        typeof row.documentId === 'number'
          ? row.documentId
          : Number(row.documentId),
      score: row.score as number,
    }));
  } catch (error) {
    console.warn('Keyword search failed', { matchExpression, error });
    return [];
  }
};
