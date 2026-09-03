import { type SourceDocument } from '../../database/chatRepository';
import { type WebSearchTraceEntry } from '../../store/webSearchStore';
import { hostname } from '../../utils/web/webResultsToContext';
import {
  describeFetchFailure,
  summarizeFetchFailures,
  type FetchFailureReason,
} from '../../utils/web/fetchFailure';

export type StepRow = {
  type: 'step';
  key: string;
  label: string;
  done?: boolean;
  active?: boolean;
};
export type PageRow = {
  type: 'page';
  key: string;
  url?: string;
  host: string;
  name: string;
  failed?: boolean;
  note?: string;
};
export type ChallengeRow = { type: 'challenge'; key: string };
export type NoteRow = {
  type: 'note';
  key: string;
  label: string;
  tone: 'warn' | 'muted';
};
export type Row = StepRow | PageRow | ChallengeRow | NoteRow;

export const buildRows = (
  isSearching: boolean,
  trace: WebSearchTraceEntry[],
  results: SourceDocument[],
  challengeActive: boolean
): Row[] => {
  const takenKeys = new Set<string>();
  const pageKey = (base: string) => {
    let key = `p-${base}`;
    let dup = 1;
    while (takenKeys.has(key)) {
      key = `p-${base}#${dup}`;
      dup += 1;
    }
    takenKeys.add(key);
    return key;
  };

  const has = (type: WebSearchTraceEntry['type']): boolean =>
    trace.some((entry) => entry.type === type);
  const countOf = (type: WebSearchTraceEntry['type']): number =>
    trace.filter((entry) => entry.type === type).length;

  const offlineNote: NoteRow = {
    type: 'note',
    key: 'offline',
    tone: 'warn',
    label: 'No internet — answered without the web',
  };
  const timeoutNote: NoteRow = {
    type: 'note',
    key: 'timeout',
    tone: 'warn',
    label: 'Search took too long — stopped early',
  };
  if (has('offline')) return [offlineNote];
  if (has('skipped')) {
    return [
      {
        type: 'note',
        key: 'skipped',
        tone: 'muted',
        label: 'No search needed — answered right away',
      },
    ];
  }
  const timedOut = has('timeout');

  const doneRow: StepRow = {
    type: 'step',
    key: 'done',
    label: 'Done',
    done: true,
  };

  const weakNote: NoteRow = {
    type: 'note',
    key: 'weak',
    tone: 'warn',
    label: 'Didn’t find much — the answer may be incomplete',
  };
  const closingRow: Row = has('weak') ? weakNote : doneRow;

  const failureSummary = summarizeFetchFailures(
    trace
      .filter((entry) => entry.type === 'failed' && entry.reason)
      .map((entry) => ({
        url: entry.url ?? '',
        host: entry.host ?? '',
        reason: entry.reason as FetchFailureReason,
      }))
  );
  const failureNote: NoteRow | null = failureSummary
    ? {
        type: 'note',
        key: 'fetch-failures',
        tone: 'muted',
        label: failureSummary,
      }
    : null;
  const withFailureNote = (rows: Row[]): Row[] =>
    failureNote ? [...rows, failureNote] : rows;

  const phaseRows: StepRow[] =
    has('reading') || has('ranking')
      ? [{ type: 'step', key: 'phase-reading', label: 'Reading the pages' }]
      : [];
  const phaseRunning = isSearching && !has('done');

  const finalizeSteps = (rows: Row[]): Row[] => {
    if (!phaseRunning) {
      return rows.map((row) =>
        row.type === 'step' && !row.done ? { ...row, done: true } : row
      );
    }
    let activeIndex = -1;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const row = rows[i]!;
      if (row.type === 'step' && !row.done) {
        activeIndex = i;
        break;
      }
    }
    if (activeIndex === -1) return rows;
    return rows.map((row, i) => {
      if (row.type !== 'step') return row;
      if (i === activeIndex) return { ...row, active: true };
      return i < activeIndex ? { ...row, done: true } : row;
    });
  };

  const isPageEntry = (entry: WebSearchTraceEntry): boolean =>
    entry.type === 'found' ||
    entry.type === 'fetched' ||
    entry.type === 'failed';
  const keyOf = (url: string | undefined, host: string) => url ?? host;

  const collectPages = (): Map<string, PageRow> => {
    const byKey = new Map<string, PageRow>();
    const remember = (
      key: string,
      next: {
        url?: string;
        host: string;
        title?: string;
        failed?: boolean;
        note?: string;
      }
    ) => {
      const current = byKey.get(key);
      if (!current) {
        byKey.set(key, {
          type: 'page',
          key: pageKey(key),
          url: next.url,
          host: next.host,
          name: next.title || next.host,
          ...(next.failed ? { failed: true } : {}),
          ...(next.note ? { note: next.note } : {}),
        });
        return;
      }
      const failed = next.failed ?? current.failed;
      const note =
        next.failed === false ? undefined : (next.note ?? current.note);
      byKey.set(key, {
        ...current,
        url: next.url ?? current.url,
        name: next.title || current.name,
        ...(failed ? { failed: true } : { failed: undefined }),
        ...(note ? { note } : { note: undefined }),
      });
    };

    for (const entry of trace) {
      if (!isPageEntry(entry) || !entry.host) continue;
      const failed = entry.type === 'failed';
      remember(keyOf(entry.url, entry.host), {
        url: entry.url,
        host: entry.host,
        title: entry.title,
        ...(entry.type === 'fetched' ? { failed: false } : {}),
        ...(failed ? { failed: true } : {}),
        ...(failed && entry.reason
          ? { note: describeFetchFailure(entry.reason) }
          : {}),
      });
    }
    for (const result of results) {
      const host = result.url ? hostname(result.url) : result.name;
      remember(keyOf(result.url, host), {
        url: result.url,
        host,
        title: result.name,
      });
    }
    return byKey;
  };

  const pageState = collectPages();
  const pages = [...pageState.values()];

  const stepLabel = (entry: WebSearchTraceEntry): string => {
    if (entry.type === 'objectives') return 'Deciding what to search for';
    if (entry.type === 'recovering') {
      return 'Couldn’t read those — looking for another source';
    }
    if (entry.query) return `Searching “${entry.query}”`;
    return 'Searching the web';
  };
  const stepFor = (entry: WebSearchTraceEntry): StepRow => ({
    type: 'step',
    key: `t-${entry.id}`,
    label: stepLabel(entry),
  });

  if (countOf('searching') >= 2) {
    const rows: Row[] = [];
    const placed = new Set<string>();
    for (const entry of trace) {
      if (
        entry.type === 'objectives' ||
        entry.type === 'searching' ||
        entry.type === 'recovering'
      ) {
        rows.push(stepFor(entry));
      } else if (isPageEntry(entry) && entry.host) {
        const key = keyOf(entry.url, entry.host);
        if (placed.has(key)) continue;
        placed.add(key);
        const page = pageState.get(key);
        if (page) rows.push(page);
      }
    }
    for (const [key, page] of pageState) {
      if (placed.has(key)) continue;
      rows.push(page);
    }
    rows.push(...phaseRows);
    if (isSearching && challengeActive) {
      rows.push({ type: 'challenge', key: 'challenge' });
    }
    if (timedOut) {
      rows.push(timeoutNote);
    } else if (!isSearching || has('done')) {
      if (failureNote) rows.push(failureNote);
      rows.push(
        pages.length > 0
          ? closingRow
          : {
              type: 'step',
              key: 'no-results',
              label: 'Nothing found',
              done: true,
            }
      );
    }
    return finalizeSteps(rows);
  }

  const steps: StepRow[] = trace
    .filter(
      (entry) =>
        entry.type === 'objectives' ||
        entry.type === 'searching' ||
        entry.type === 'recovering'
    )
    .map(stepFor);

  const savedSteps = (): StepRow[] => {
    const query = results.find((result) => result.query)?.query;
    return [
      { type: 'step', key: 'objectives', label: 'Deciding what to search for' },
      ...(query
        ? [
            {
              type: 'step' as const,
              key: 'query',
              label: `Searching “${query}”`,
            },
          ]
        : []),
    ];
  };

  const openingSteps = steps.length > 0 ? steps : savedSteps();

  if (!isSearching) {
    if (pages.length > 0) {
      return finalizeSteps([
        ...openingSteps,
        ...pages,
        ...phaseRows,
        ...withFailureNote([]),
        closingRow,
      ]);
    }
    if (timedOut) {
      return finalizeSteps([...steps, timeoutNote]);
    }
    if (has('searching')) {
      return finalizeSteps([
        ...steps,
        { type: 'step', key: 'no-results', label: 'Nothing found', done: true },
      ]);
    }
    return [];
  }

  return finalizeSteps([
    ...steps,
    ...pages,
    ...phaseRows,
    ...(challengeActive
      ? [{ type: 'challenge', key: 'challenge' } as ChallengeRow]
      : []),
    ...(timedOut ? [timeoutNote] : []),
    ...(has('done') ? withFailureNote([]) : []),
    ...(has('done') ? [closingRow] : []),
  ]);
};
