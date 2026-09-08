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
}

export const answerTraceEnabled = WEB_TRACE_TO_FILE;

export const recordAnswerTrace = async (trace: AnswerTrace): Promise<void> => {
  if (!WEB_TRACE_TO_FILE) return;
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
        final: trace.final,
      },
      null,
      2
    )
  );
};
