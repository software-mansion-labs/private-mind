import { WEB_TRACE_TO_FILE } from '../constants/web';
import { writeTraceFile } from './traceFile';

const TRACE_DIR = 'answer-traces';

export interface AnswerRetry {
  reason: string;
  raw: string | null;
  accepted: boolean;
}

export interface AnswerTrace {
  question: string;
  raw: string;
  tidied: string;
  retries: AnswerRetry[];
  final: string;
  systemPromptChars: number;
  shape?: Record<string, boolean>;
  chatId?: number;
  promptMessages?: number;
}

export type AnswerTraceListener = (trace: AnswerTrace) => void;

const answerTraceListeners = new Set<AnswerTraceListener>();

export const listenToAnswerTraces = (
  listener: AnswerTraceListener
): (() => void) => {
  answerTraceListeners.add(listener);
  return () => {
    answerTraceListeners.delete(listener);
  };
};

const notifyAnswerTraceListeners = (trace: AnswerTrace): void => {
  for (const listener of answerTraceListeners) {
    try {
      listener(trace);
    } catch (error) {
      console.warn(`Answer trace listener failed ${String(error)}`);
    }
  }
};

export const recordAnswerTrace = async (
  trace: AnswerTrace,
  { toFile = WEB_TRACE_TO_FILE }: { toFile?: boolean } = {}
): Promise<void> => {
  notifyAnswerTraceListeners(trace);
  if (!toFile) return;
  await writeTraceFile(
    TRACE_DIR,
    trace.question,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        question: trace.question,
        systemPromptChars: trace.systemPromptChars,
        raw: trace.raw,
        tidied: trace.tidied,
        retries: trace.retries,
        shape: trace.shape ?? {},
        final: trace.final,
      },
      null,
      2
    )
  );
};
