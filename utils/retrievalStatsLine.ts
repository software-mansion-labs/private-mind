import type { RetrievalStats } from '../database/chatRepository';

const counted = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

export const retrievalStatsLines = (stats?: RetrievalStats): string[] => {
  const lines: string[] = [];

  if (stats?.rag) {
    lines.push(
      `rag: ${stats.rag.ms} ms, ${counted(stats.rag.chunks, 'chunk', 'chunks')}`
    );
  }

  if (stats?.web) {
    lines.push(
      [
        `web: ${stats.web.ms} ms`,
        counted(stats.web.sources, 'source', 'sources'),
        `${stats.web.read} read`,
        counted(stats.web.queries, 'query', 'queries'),
      ].join(', ')
    );
  }

  return lines;
};
