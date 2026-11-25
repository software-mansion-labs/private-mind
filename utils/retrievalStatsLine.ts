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

  if (stats?.memory) {
    lines.push(
      [
        `memory: ${counted(stats.memory.turnsDropped, 'message', 'messages')} dropped`,
        `${stats.memory.messagesRecalled} recalled (${stats.memory.recallMode})`,
        `${stats.memory.recallTokens} recall tokens`,
        `${stats.memory.digestChars} digest chars`,
      ].join(', ')
    );
  }

  return lines;
};
