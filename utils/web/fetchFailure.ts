export type FetchFailureReason =
  | 'blocked'
  | 'not-found'
  | 'server-error'
  | 'timeout'
  | 'unsupported'
  | 'too-large'
  | 'empty'
  | 'network'
  | 'aborted';

export interface FetchFailure {
  url: string;
  host: string;
  reason: FetchFailureReason;
}

const STATUS_PATTERN = /\b(\d{3})\b/;

const BLOCKING_STATUSES = new Set([401, 402, 403, 407, 423, 429, 451]);
const MISSING_STATUSES = new Set([404, 410]);

const statusReason = (status: number): FetchFailureReason => {
  if (BLOCKING_STATUSES.has(status)) return 'blocked';
  if (MISSING_STATUSES.has(status)) return 'not-found';
  if (status >= 500) return 'server-error';
  return 'network';
};

export const classifyFetchError = (error: unknown): FetchFailureReason => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/aborted/i.test(message)) return 'aborted';
  if (/timed out/i.test(message)) return 'timeout';
  if (/unsupported content type|binary body/i.test(message)) {
    return 'unsupported';
  }
  if (/too large/i.test(message)) return 'too-large';
  if (/refusing (?:to fetch|redirect)/i.test(message)) return 'blocked';
  if (/fetch failed:/i.test(message)) {
    const status = Number(message.match(STATUS_PATTERN)?.[1]);
    return Number.isFinite(status) ? statusReason(status) : 'network';
  }
  return 'network';
};

export const classifyUnusableContent = (
  isBotWall: boolean
): FetchFailureReason => (isBotWall ? 'blocked' : 'empty');

const HOST_LEVEL_REASONS = new Set<FetchFailureReason>([
  'blocked',
  'server-error',
]);

export const isHostLevelFailure = (reason: FetchFailureReason): boolean =>
  HOST_LEVEL_REASONS.has(reason);

const RETRYABLE_REASONS = new Set<FetchFailureReason>([
  'blocked',
  'not-found',
  'server-error',
  'timeout',
  'unsupported',
  'too-large',
  'empty',
  'network',
]);

export const isRecoverableFailure = (reason: FetchFailureReason): boolean =>
  RETRYABLE_REASONS.has(reason);

const REASON_LABELS: Record<FetchFailureReason, string> = {
  'blocked': 'blocked the reader',
  'not-found': 'page is gone',
  'server-error': 'site is down',
  'timeout': 'took too long',
  'unsupported': 'not readable text',
  'too-large': 'page too big',
  'empty': 'no readable text',
  'network': 'could not be reached',
  'aborted': 'stopped',
};

export const describeFetchFailure = (reason: FetchFailureReason): string =>
  REASON_LABELS[reason];

export const summarizeFetchFailures = (failures: FetchFailure[]): string => {
  const recoverable = failures.filter((failure) =>
    isRecoverableFailure(failure.reason)
  );
  if (recoverable.length === 0) return '';
  const counts = new Map<FetchFailureReason, number>();
  for (const failure of recoverable) {
    counts.set(failure.reason, (counts.get(failure.reason) ?? 0) + 1);
  }
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  const pages =
    recoverable.length === 1 ? '1 page' : `${recoverable.length} pages`;
  return `Couldn’t read ${pages} — ${describeFetchFailure(dominant[0])}`;
};
