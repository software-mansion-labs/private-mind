import {
  DocumentDirectoryPath,
  ExternalDirectoryPath,
  mkdir,
  readDir,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';
import { WEB_TRACE_KEEP_FILES, WEB_TRACE_TO_FILE } from '../../constants/web';
import type { WebSearchTelemetry } from './runWebSearch';
import type { WebSearchResult } from './types';

const TRACE_DIR = 'web-traces';

export interface WebSearchTrace {
  question: string;
  expects?: string[];
  planQueries?: string[];
  candidates?: string[];
  budget?: number;
  contextOffset?: number;
  results: WebSearchResult[];
  context: string[];
  telemetry: WebSearchTelemetry;
}

const traceDirectory = (): string =>
  `${ExternalDirectoryPath || DocumentDirectoryPath}/${TRACE_DIR}`;

const traceFileName = (question: string): string => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `${stamp}${slug ? `-${slug}` : ''}.json`;
};

const traceBody = (trace: WebSearchTrace): string =>
  JSON.stringify(
    {
      at: new Date().toISOString(),
      question: trace.question,
      expects: trace.expects ?? [],
      planQueries: trace.planQueries ?? [],
      candidates: trace.candidates ?? [],
      budget: trace.budget ?? null,
      contextOffset: trace.contextOffset ?? 0,
      sources: trace.results.map((result) => ({
        url: result.url,
        title: result.title,
        sourceQuery: result.sourceQuery ?? null,
        snippet: result.snippet,
        contentChars: result.content?.length ?? 0,
        content: result.content ?? null,
        product: result.product ?? null,
      })),
      context: trace.context,
      telemetry: trace.telemetry,
    },
    null,
    2
  );

const pruneOldTraces = async (directory: string): Promise<void> => {
  const traces = (await readDir(directory))
    .filter((entry) => entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const stale of traces.slice(0, traces.length - WEB_TRACE_KEEP_FILES)) {
    await unlink(stale.path);
  }
};

export const recordWebSearchTrace = async (
  trace: WebSearchTrace
): Promise<void> => {
  if (!WEB_TRACE_TO_FILE) return;
  try {
    const directory = traceDirectory();
    await mkdir(directory);
    const path = `${directory}/${traceFileName(trace.question)}`;
    await writeFile(path, traceBody(trace), 'utf8');
    await pruneOldTraces(directory);
    console.log(`Web search trace ${path}`);
  } catch (error) {
    console.warn(`Web search trace failed ${String(error)}`);
  }
};
