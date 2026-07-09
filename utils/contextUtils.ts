import { MIN_STITCH_OVERLAP, SOURCE_HEADER } from '../constants/retrieval';

export type ContextChunk = {
  document?: string;
  similarity: number;
  metadata?: {
    documentId?: number;
    name?: string;
  };
};

export type SourceDocument = {
  documentId?: number;
  name: string;
  passage?: string;
  similarity?: number;
};

type FirstChunkSource = {
  id: number;
  name: string;
  firstChunk?: string;
};

export const sourceKey = (
  documentId: number | undefined,
  name: string
): string => `${documentId ?? 'unknown'}:${name}`;

type DocumentGroup = {
  documentId?: number;
  name: string;
  chunks: ContextChunk[];
  maxSimilarity: number;
};

const chunkDocumentName = (item: ContextChunk): string =>
  item.metadata?.name || `Document ${item.metadata?.documentId || 'Unknown'}`;

const groupChunksByDocument = (chunks: ContextChunk[]): DocumentGroup[] => {
  const groups = new Map<string, DocumentGroup>();
  const order: string[] = [];

  for (const item of chunks) {
    const name = chunkDocumentName(item);
    const key = sourceKey(item.metadata?.documentId, name);
    const existing = groups.get(key);

    if (existing) {
      existing.chunks.push(item);
      existing.maxSimilarity = Math.max(
        existing.maxSimilarity,
        item.similarity
      );
    } else {
      groups.set(key, {
        documentId: item.metadata?.documentId,
        name,
        chunks: [item],
        maxSimilarity: item.similarity,
      });
      order.push(key);
    }
  }

  return order.map((key) => groups.get(key)!);
};

// Drop the leading part of `next` that repeats the tail of `prev`, longest match first.
const stripLeadingOverlap = (prev: string, next: string): string => {
  const max = Math.min(prev.length, next.length);
  for (let len = max; len >= MIN_STITCH_OVERLAP; len--) {
    if (prev.slice(prev.length - len) === next.slice(0, len)) {
      return next.slice(len);
    }
  }
  return next;
};

const joinGroupPassages = (group: DocumentGroup): string => {
  const passages = group.chunks
    .map((chunk) => chunk.document?.trim() ?? '')
    .filter(Boolean);
  if (passages.length === 0) return '';

  let stitched = passages[0]!;
  for (let i = 1; i < passages.length; i++) {
    const deduped = stripLeadingOverlap(stitched, passages[i]!).trimStart();
    if (deduped) stitched += `\n\n${deduped}`;
  }
  return stitched;
};

export const formatContextChunks = (chunks: ContextChunk[]): string[] =>
  groupChunksByDocument(chunks).map(
    (group, index) =>
      `\n --- Source ${index + 1}: ${
        group.name
      } --- \n ${joinGroupPassages(group)} \n --- End of Source ${
        index + 1
      } ---`
  );

export const getSourceDocumentsFromChunks = (
  chunks: ContextChunk[]
): SourceDocument[] =>
  groupChunksByDocument(chunks).map((group) => ({
    documentId: group.documentId,
    name: group.name,
    passage: joinGroupPassages(group),
    similarity: group.maxSimilarity,
  }));

export const sourcesPresentInContext = (
  contextContent: string
): Set<string> => {
  const names = new Set<string>();
  for (const match of contextContent.matchAll(SOURCE_HEADER)) {
    names.add(match[1]!.replace(/ \(Overview\)$/, '').trim());
  }
  return names;
};

export const formatFirstChunks = (
  sources: FirstChunkSource[],
  label = 'Source'
): string[] => {
  return sources
    .filter((s) => s.firstChunk)
    .map(
      (s) =>
        `\n --- ${label}: ${s.name} (Overview) --- \n ${s.firstChunk!.trim()} \n --- End of ${label} ---`
    );
};
