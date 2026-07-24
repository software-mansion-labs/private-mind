import { type SourceDocument } from '../../database/chatRepository';
import { type WebSearchTraceEntry } from '../../store/webSearchStore';
import { hostname } from '../../utils/web/webResultsToContext';

export type StepRow = {
  type: 'step';
  key: string;
  label: string;
  done?: boolean;
};
export type PageRow = {
  type: 'page';
  key: string;
  url?: string;
  host: string;
  name: string;
};
export type ChallengeRow = { type: 'challenge'; key: string };
export type Row = StepRow | PageRow | ChallengeRow;

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

  const pagesFromResults: PageRow[] = results.map((result) => ({
    type: 'page',
    key: pageKey(result.url ?? result.name),
    url: result.url,
    host: result.url ? hostname(result.url) : result.name,
    name: result.name,
  }));

  const doneRow: StepRow = {
    type: 'step',
    key: 'done',
    label: 'Done',
    done: true,
  };

  if (!isSearching) {
    if (pagesFromResults.length === 0) return [];
    const query = results.find((result) => result.query)?.query;
    return [
      { type: 'step', key: 'objectives', label: 'Defining objectives' },
      ...(query
        ? [
            {
              type: 'step' as const,
              key: 'query',
              label: `Searching “${query}”`,
            },
          ]
        : []),
      ...pagesFromResults,
      doneRow,
    ];
  }

  const steps: StepRow[] = [];
  const livePages: PageRow[] = [];
  const seenHost = new Set<string>();
  for (const entry of trace) {
    if (entry.type === 'objectives') {
      steps.push({
        type: 'step',
        key: `t-${entry.id}`,
        label: 'Defining objectives',
      });
    } else if (entry.type === 'searching') {
      steps.push({
        type: 'step',
        key: `t-${entry.id}`,
        label: entry.query ? `Searching “${entry.query}”` : 'Searching the web',
      });
    } else if (
      (entry.type === 'fetched' || entry.type === 'failed') &&
      entry.host &&
      !seenHost.has(entry.host)
    ) {
      seenHost.add(entry.host);
      livePages.push({
        type: 'page',
        key: pageKey(entry.url ?? entry.host),
        url: entry.url,
        host: entry.host,
        name: entry.host,
      });
    }
  }

  return [
    ...steps,
    ...(pagesFromResults.length ? pagesFromResults : livePages),
    ...(challengeActive
      ? [{ type: 'challenge', key: 'challenge' } as ChallengeRow]
      : []),
    ...(trace.some((entry) => entry.type === 'done') ? [doneRow] : []),
  ];
};
