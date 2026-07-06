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

const joinGroupPassages = (group: DocumentGroup): string =>
  group.chunks
    .map((chunk) => chunk.document?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n');

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
