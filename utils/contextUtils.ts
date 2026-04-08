const SIMILARITY_THRESHOLD = 0.3;
const MAX_RELEVANT_CHUNKS = 3;

interface ContextChunk {
  document: string;
  similarity: number;
  metadata?: {
    documentId?: number;
    name?: string;
  };
}

interface FirstChunkSource {
  id: number;
  name: string;
  firstChunk?: string;
}

export const filterAndFormatContext = (chunks: ContextChunk[]): string[] => {
  if (chunks.length === 0) return [];

  const relevant = chunks
    .filter((c) => c.similarity >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_RELEVANT_CHUNKS);

  return relevant.map((item, index) => {
    const documentName =
      item.metadata?.name ||
      `Document ${item.metadata?.documentId || 'Unknown'}`;
    const relevanceScore = item.similarity
      ? `(Relevance: ${(item.similarity * 100).toFixed(1)}%)`
      : '';

    return `\n --- Source ${
      index + 1
    }: ${documentName} ${relevanceScore} --- \n ${item.document?.trim()} \n --- End of Source ${
      index + 1
    } ---`;
  });
};

export const formatFirstChunks = (sources: FirstChunkSource[]): string[] => {
  return sources
    .filter((s) => s.firstChunk)
    .map(
      (s) =>
        `\n --- Source: ${s.name} (Overview) --- \n ${s.firstChunk!.trim()} \n --- End of Source ---`
    );
};
