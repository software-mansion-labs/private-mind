export type DownloadPhase =
  | 'requested'
  | 'queued'
  | 'started'
  | 'completed'
  | 'failed'
  | 'abandoned'
  | 'cancel-requested'
  | 'cancel-waiting'
  | 'cancel-landed'
  | 'cancel-failed';

interface DownloadEvent {
  at: number;
  modelId: number;
  modelName: string;
  phase: DownloadPhase;
  detail?: string;
}

const TRACE_LIMIT = 200;
const trace: DownloadEvent[] = [];

const format = ({ at, modelId, modelName, phase, detail }: DownloadEvent) =>
  `${new Date(at).toISOString().slice(11, 23)} [${modelId}] ${modelName} ${phase}${
    detail ? ` — ${detail}` : ''
  }`;

export const describeDownloadError = (error: unknown) =>
  error instanceof Error
    ? `${error.name}(${(error as { code?: unknown }).code ?? '?'}): ${error.message}`
    : String(error);

export const recordDownloadEvent = (
  modelId: number,
  modelName: string,
  phase: DownloadPhase,
  detail?: string
) => {
  const event: DownloadEvent = {
    at: Date.now(),
    modelId,
    modelName,
    phase,
    detail,
  };
  trace.push(event);
  if (trace.length > TRACE_LIMIT) trace.shift();
  if (process.env.NODE_ENV !== 'test') {
    console.log(`download ${format(event)}`);
  }
};

export const readDownloadTrace = () => trace.map(format);

export const clearDownloadTrace = () => {
  trace.length = 0;
};

(globalThis as { __downloadTrace?: () => string[] }).__downloadTrace =
  readDownloadTrace;
