import { WEB_TRACE_KEEP_FILES, WEB_TRACE_TO_FILE } from '../../constants/web';
import { writeTraceFile } from '../traceFile';
import type { WebSearchTelemetry } from './runWebSearch';
import type { WebSearchResult } from './types';

const TRACE_DIR = 'web-traces';
const EXTRACT_MAX_CHARS = 20_000;

export interface WebSearchTrace {
  question: string;
  expects?: string[];
  planQueries?: string[];
  candidates?: string[];
  extracted?: Record<string, string>;
  retrievalQuery?: string;
  budget?: number;
  contextOffset?: number;
  results: WebSearchResult[];
  context: string[];
  telemetry: WebSearchTelemetry;
}

const traceBody = (trace: WebSearchTrace): string =>
  JSON.stringify(
    {
      at: new Date().toISOString(),
      question: trace.question,
      expects: trace.expects ?? [],
      planQueries: trace.planQueries ?? [],
      candidates: trace.candidates ?? [],
      retrievalQuery: trace.retrievalQuery ?? null,
      budget: trace.budget ?? null,
      contextOffset: trace.contextOffset ?? 0,
      sources: trace.results.map((result) => ({
        url: result.url,
        title: result.title,
        sourceQuery: result.sourceQuery ?? null,
        snippet: result.snippet,
        contentChars: result.content?.length ?? 0,
        content: result.content ?? null,
        extracted:
          trace.extracted?.[result.url]?.slice(0, EXTRACT_MAX_CHARS) ?? null,
        product: result.product ?? null,
      })),
      context: trace.context,
      telemetry: trace.telemetry,
    },
    null,
    2
  );

export const recordWebSearchTrace = async (
  trace: WebSearchTrace,
  {
    toFile = WEB_TRACE_TO_FILE,
    keepFiles = WEB_TRACE_KEEP_FILES,
  }: { toFile?: boolean; keepFiles?: number } = {}
): Promise<void> => {
  if (!toFile) return;
  await writeTraceFile(TRACE_DIR, trace.question, traceBody(trace), keepFiles);
};
