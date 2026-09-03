import { buildRows } from '../components/chat-screen/webSearchTrace';
import { type WebSearchTraceEntry } from '../store/webSearchStore';
import { type SourceDocument } from '../database/chatRepository';

type Rows = ReturnType<typeof buildRows>;

const ev = (over: Partial<WebSearchTraceEntry>): WebSearchTraceEntry => ({
  id: 0,
  type: 'searching',
  ...over,
});

const src = (over: Partial<SourceDocument> = {}): SourceDocument => ({
  name: 'Result',
  ...over,
});

const labelsOf = (rows: Rows) =>
  rows.flatMap((row) => (row.type === 'step' ? [row.label] : []));
const hostsOf = (rows: Rows) =>
  rows.flatMap((row) => (row.type === 'page' ? [row.host] : []));
const types = (rows: Rows) => rows.map((row) => row.type);

describe('buildRows — finished search', () => {
  it('is empty when the search produced no pages', () => {
    expect(buildRows(false, [], [], false)).toEqual([]);
  });

  it('frames results with objectives and a done row', () => {
    const rows = buildRows(
      false,
      [],
      [src({ name: 'A', url: 'https://a.com/x' })],
      false
    );
    expect(labelsOf(rows)).toEqual(['Deciding what to search for', 'Done']);
    expect(hostsOf(rows)).toEqual(['a.com']);
    expect(rows[rows.length - 1]).toMatchObject({ type: 'step', done: true });
  });

  it('adds a query step when a result carries the query', () => {
    const rows = buildRows(
      false,
      [],
      [src({ url: 'https://a.com/x', query: 'warsaw weather' })],
      false
    );
    expect(labelsOf(rows)).toEqual([
      'Deciding what to search for',
      'Searching “warsaw weather”',
      'Done',
    ]);
  });

  it('falls back to the name as host when a result has no url', () => {
    const rows = buildRows(false, [], [src({ name: 'Local note' })], false);
    expect(hostsOf(rows)).toEqual(['Local note']);
  });

  it('keeps the traced pages while the sources are still being attached', () => {
    const trace = [
      ev({ id: 0, type: 'searching', query: 'gdansk weather' }),
      ev({ id: 1, type: 'fetched', host: 'a.com', url: 'https://a.com/x' }),
    ];
    const rows = buildRows(false, trace, [], false);
    expect(labelsOf(rows)).not.toContain('Nothing found');
    expect(hostsOf(rows)).toEqual(['a.com']);
  });

  it('reports no results only when neither sources nor pages exist', () => {
    const trace = [ev({ id: 0, type: 'searching', query: 'gdansk weather' })];
    expect(labelsOf(buildRows(false, trace, [], false))).toContain(
      'Nothing found'
    );
  });

  it('says so when the planner skipped the search', () => {
    const rows = buildRows(
      false,
      [ev({ id: 0, type: 'objectives' }), ev({ id: 1, type: 'skipped' })],
      [],
      false
    );
    expect(rows).toEqual([
      {
        type: 'note',
        key: 'skipped',
        tone: 'muted',
        label: 'No search needed — answered right away',
      },
    ]);
  });
});

describe('buildRows — the search ran out without an answer', () => {
  const thin = [
    ev({ id: 1, type: 'searching', query: 'wanna olx' }),
    ev({ id: 2, type: 'fetched', host: 'olx.pl', url: 'https://olx.pl/1' }),
    ev({ id: 3, type: 'searching', query: 'wanna cena olx' }),
    ev({ id: 4, type: 'weak' }),
    ev({ id: 5, type: 'done' }),
  ];

  it('closes with the shortfall instead of Done', () => {
    const rows = buildRows(false, thin, [], false);
    const last = rows[rows.length - 1]!;
    expect(last).toMatchObject({
      type: 'note',
      tone: 'warn',
      label: 'Didn’t find much — the answer may be incomplete',
    });
    expect(labelsOf(rows)).not.toContain('Done');
  });

  it('still closes with Done when the last round came back strong', () => {
    const strong = thin.filter((entry) => entry.type !== 'weak');
    expect(labelsOf(buildRows(false, strong, [], false))).toContain('Done');
  });

  it('keeps saying Nothing found when no page was ever surfaced', () => {
    const rows = buildRows(
      false,
      [
        ev({ id: 1, type: 'searching', query: 'a' }),
        ev({ id: 2, type: 'searching', query: 'b' }),
        ev({ id: 3, type: 'weak' }),
        ev({ id: 4, type: 'done' }),
      ],
      [],
      false
    );
    expect(labelsOf(rows)).toContain('Nothing found');
  });
});

describe('buildRows — live search', () => {
  it('maps objectives and searching entries to steps', () => {
    const rows = buildRows(
      true,
      [
        ev({ id: 1, type: 'objectives' }),
        ev({ id: 2, type: 'searching', query: 'cats' }),
        ev({ id: 3, type: 'searching' }),
      ],
      [],
      false
    );
    expect(labelsOf(rows)).toEqual([
      'Deciding what to search for',
      'Searching “cats”',
      'Searching the web',
    ]);
  });

  it('marks the last open step as the action happening now', () => {
    const searching = buildRows(
      true,
      [
        ev({ id: 1, type: 'objectives' }),
        ev({ id: 2, type: 'searching', query: 'cats' }),
        ev({ id: 3, type: 'found', host: 'a.com', url: 'https://a.com/1' }),
      ],
      [],
      false
    );
    const activeRows = searching.filter(
      (row) => row.type === 'step' && row.active
    );
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]).toMatchObject({ label: 'Searching “cats”' });

    const reading = buildRows(
      true,
      [
        ev({ id: 1, type: 'searching', query: 'cats' }),
        ev({ id: 2, type: 'fetched', host: 'a.com', url: 'https://a.com/1' }),
        ev({ id: 3, type: 'reading' }),
      ],
      [],
      false
    );
    expect(
      reading.filter((row) => row.type === 'step' && row.active)[0]
    ).toMatchObject({ label: 'Reading the pages' });
  });

  it('checks off a step the moment the trace moves past it, not just once the whole search ends (reported: stayed a bare dot forever)', () => {
    const rows = buildRows(
      true,
      [
        ev({ id: 1, type: 'objectives' }),
        ev({ id: 2, type: 'searching', query: 'cats' }),
        ev({ id: 3, type: 'found', host: 'a.com', url: 'https://a.com/1' }),
      ],
      [],
      false
    );
    expect(rows[0]).toMatchObject({
      label: 'Deciding what to search for',
      done: true,
    });
    expect(rows[1]).toMatchObject({ label: 'Searching “cats”', active: true });
  });

  it('checks off every step once the search is completely over, even a step that was never superseded by a later one', () => {
    const rows = buildRows(
      false,
      [ev({ id: 1, type: 'objectives' }), ev({ id: 2, type: 'searching' })],
      [],
      false
    );
    expect(rows[0]).toMatchObject({
      label: 'Deciding what to search for',
      done: true,
    });
    expect(rows[1]).toMatchObject({ label: 'Searching the web', done: true });
  });

  it('leaves nothing active once the search reports done or is over', () => {
    const trace = [
      ev({ id: 1, type: 'searching', query: 'cats' }),
      ev({ id: 2, type: 'fetched', host: 'a.com', url: 'https://a.com/1' }),
      ev({ id: 3, type: 'reading' }),
    ];
    const afterDone = buildRows(
      true,
      [...trace, ev({ id: 4, type: 'done' })],
      [],
      false
    );
    const finished = buildRows(false, trace, [], false);
    for (const rows of [afterDone, finished]) {
      expect(rows.some((row) => row.type === 'step' && row.active)).toBe(false);
    }
  });

  it('keeps every page it touched, in the order it appeared', () => {
    const rows = buildRows(
      true,
      [
        ev({ id: 1, type: 'found', host: 'c.com', url: 'https://c.com/1' }),
        ev({ id: 2, type: 'fetched', host: 'a.com', url: 'https://a.com/1' }),
        ev({ id: 3, type: 'fetched', host: 'a.com', url: 'https://a.com/2' }),
        ev({ id: 4, type: 'failed', host: 'b.com', url: 'https://b.com/1' }),
      ],
      [],
      false
    );
    expect(hostsOf(rows)).toEqual(['c.com', 'a.com', 'a.com', 'b.com']);
  });

  it('keeps the listing title once its page is opened', () => {
    const found = ev({
      id: 1,
      type: 'found',
      host: 'a.com',
      url: 'https://a.com/1',
      title: 'Weather in Warsaw',
    });
    const opened = ev({
      id: 2,
      type: 'fetched',
      host: 'a.com',
      url: 'https://a.com/1',
    });

    for (const trace of [[found], [found, opened]]) {
      const page = buildRows(true, trace, [], false).find(
        (row) => row.type === 'page'
      );
      expect(page).toMatchObject({ name: 'Weather in Warsaw' });
    }
  });

  it('still names a page by host when nothing ever titled it', () => {
    const rows = buildRows(
      true,
      [ev({ id: 1, type: 'fetched', host: 'a.com', url: 'https://a.com/1' })],
      [],
      false
    );
    expect(rows.find((row) => row.type === 'page')).toMatchObject({
      name: 'a.com',
    });
  });

  it('keeps one plain row per page whatever happened to it later', () => {
    const rows = buildRows(
      true,
      [
        ev({ id: 1, type: 'found', host: 'a.com', url: 'https://a.com/1' }),
        ev({ id: 2, type: 'found', host: 'b.com', url: 'https://b.com/1' }),
        ev({ id: 3, type: 'fetched', host: 'a.com', url: 'https://a.com/1' }),
        ev({ id: 4, type: 'failed', host: 'b.com', url: 'https://b.com/1' }),
      ],
      [],
      false
    );
    const pages = rows.flatMap((row) => (row.type === 'page' ? [row] : []));
    expect(pages.map((page) => page.host)).toEqual(['a.com', 'b.com']);
    expect(pages.some((page) => 'read' in page)).toBe(false);
  });

  it('never drops a row when the search finishes', () => {
    const trace = [
      ev({ id: 0, type: 'searching', query: 'q' }),
      ev({ id: 1, type: 'found', host: 'c.com', url: 'https://c.com/1' }),
      ev({ id: 2, type: 'fetched', host: 'a.com', url: 'https://a.com/1' }),
      ev({ id: 3, type: 'reading' }),
      ev({ id: 4, type: 'done' }),
    ];
    const live = hostsOf(buildRows(true, trace, [], false));
    const finished = hostsOf(
      buildRows(
        false,
        trace,
        [src({ name: 'A', url: 'https://a.com/1', read: true })],
        false
      )
    );
    expect(finished).toEqual(expect.arrayContaining(live));
    expect(finished).toHaveLength(live.length);
  });

  it('adds no commentary about which pages were used', () => {
    const rows = buildRows(
      false,
      [
        ev({ id: 0, type: 'searching', query: 'q' }),
        ev({ id: 1, type: 'fetched', host: 'a.com', url: 'https://a.com/1' }),
        ev({ id: 2, type: 'failed', host: 'b.com', url: 'https://b.com/1' }),
        ev({ id: 3, type: 'reading' }),
        ev({ id: 4, type: 'done' }),
      ],
      [],
      false
    );
    expect(rows.some((row) => row.type === 'note')).toBe(false);
    expect(hostsOf(rows)).toEqual(['a.com', 'b.com']);
  });

  it('appends a challenge row only while a challenge is active', () => {
    const trace = [ev({ id: 1, type: 'searching', query: 'q' })];
    expect(types(buildRows(true, trace, [], true))).toContain('challenge');
    expect(types(buildRows(true, trace, [], false))).not.toContain('challenge');
  });

  it('appends a done row only once the trace reports done', () => {
    const base = [ev({ id: 1, type: 'searching', query: 'q' })];
    expect(labelsOf(buildRows(true, base, [], false))).not.toContain('Done');
    expect(
      labelsOf(
        buildRows(true, [...base, ev({ id: 2, type: 'done' })], [], false)
      )
    ).toContain('Done');
  });

  it('adds arriving results below the pages already listed', () => {
    const trace = [
      ev({ id: 1, type: 'fetched', host: 'live.com', url: 'https://live.com' }),
    ];
    const rows = buildRows(
      true,
      trace,
      [src({ url: 'https://final.com/x' })],
      false
    );
    expect(hostsOf(rows)).toEqual(['live.com', 'final.com']);
  });
});

describe('buildRows — pages that could not be read', () => {
  const pagesOf = (rows: Rows) =>
    rows.flatMap((row) => (row.type === 'page' ? [row] : []));
  const notesOf = (rows: Rows) =>
    rows.flatMap((row) => (row.type === 'note' ? [row.label] : []));

  it('marks a failed page and says why, instead of showing it like any other', () => {
    const rows = buildRows(
      false,
      [
        ev({ id: 1, type: 'searching', query: 'galaxy s25' }),
        ev({
          id: 2,
          type: 'found',
          host: 'shop.example',
          url: 'https://shop.example/a',
        }),
        ev({
          id: 3,
          type: 'failed',
          host: 'shop.example',
          url: 'https://shop.example/a',
          reason: 'blocked',
        }),
      ],
      [],
      false
    );
    expect(pagesOf(rows)).toEqual([
      expect.objectContaining({
        host: 'shop.example',
        failed: true,
        note: 'blocked the reader',
      }),
    ]);
  });

  it('does not mark a page that was read fine', () => {
    const rows = buildRows(
      false,
      [
        ev({ id: 1, type: 'searching', query: 'galaxy s25' }),
        ev({
          id: 2,
          type: 'fetched',
          host: 'samsung.com',
          url: 'https://samsung.com/a',
        }),
      ],
      [],
      false
    );
    expect(pagesOf(rows)[0]).toMatchObject({ host: 'samsung.com' });
    expect(pagesOf(rows)[0]!.failed).toBeFalsy();
  });

  it('clears the failed mark when a retry of the same page succeeds', () => {
    const rows = buildRows(
      false,
      [
        ev({ id: 1, type: 'searching', query: 'galaxy s25' }),
        ev({
          id: 2,
          type: 'failed',
          host: 'shop.example',
          url: 'https://shop.example/a',
          reason: 'timeout',
        }),
        ev({
          id: 3,
          type: 'fetched',
          host: 'shop.example',
          url: 'https://shop.example/a',
        }),
      ],
      [],
      false
    );
    expect(pagesOf(rows)[0]!.failed).toBeFalsy();
    expect(pagesOf(rows)[0]!.note).toBeFalsy();
  });

  it('sums the failures up in one note before closing the trace', () => {
    const rows = buildRows(
      false,
      [
        ev({ id: 1, type: 'searching', query: 'galaxy s25' }),
        ev({
          id: 2,
          type: 'failed',
          host: 'a.example',
          url: 'https://a.example/x',
          reason: 'blocked',
        }),
        ev({
          id: 3,
          type: 'failed',
          host: 'b.example',
          url: 'https://b.example/x',
          reason: 'blocked',
        }),
        ev({ id: 4, type: 'done' }),
      ],
      [],
      false
    );
    expect(notesOf(rows)).toContain(
      'Couldn’t read 2 pages — blocked the reader'
    );
  });

  it('shows the recovery search as its own step', () => {
    const rows = buildRows(
      false,
      [
        ev({ id: 1, type: 'objectives' }),
        ev({ id: 2, type: 'searching', query: 'galaxy s25 cena' }),
        ev({
          id: 3,
          type: 'failed',
          host: 'shop.example',
          url: 'https://shop.example/a',
          reason: 'blocked',
        }),
        ev({ id: 4, type: 'recovering', round: 2 }),
        ev({
          id: 5,
          type: 'searching',
          query: 'Galaxy S25 -site:shop.example',
        }),
        ev({
          id: 6,
          type: 'fetched',
          host: 'samsung.com',
          url: 'https://samsung.com/a',
        }),
        ev({ id: 7, type: 'done' }),
      ],
      [],
      false
    );
    expect(labelsOf(rows)).toContain(
      'Couldn’t read those — looking for another source'
    );
    expect(hostsOf(rows)).toEqual(['shop.example', 'samsung.com']);
  });

  it('leaves the trace unchanged when nothing failed', () => {
    const rows = buildRows(
      false,
      [
        ev({ id: 1, type: 'searching', query: 'galaxy s25' }),
        ev({
          id: 2,
          type: 'fetched',
          host: 'samsung.com',
          url: 'https://samsung.com/a',
        }),
        ev({ id: 3, type: 'done' }),
      ],
      [],
      false
    );
    expect(notesOf(rows)).toEqual([]);
  });
});

describe('regressions the trace panel keeps reintroducing', () => {
  const searchRun: WebSearchTraceEntry[] = [
    ev({ id: 1, type: 'objectives' }),
    ev({ id: 2, type: 'searching', query: 'karnet zakopane' }),
    ev({ id: 3, type: 'found', url: 'https://a.com/x', host: 'a.com' }),
    ev({ id: 4, type: 'fetched', url: 'https://a.com/x', host: 'a.com' }),
  ];
  const reading = ev({ id: 5, type: 'reading' });

  it('keeps every earlier row when the reading phase starts', () => {
    const before = buildRows(true, searchRun, [], false);
    const after = buildRows(true, [...searchRun, reading], [], false);

    expect(labelsOf(after)).toEqual(
      expect.arrayContaining(['Deciding what to search for'])
    );
    expect(hostsOf(after)).toEqual(hostsOf(before));
    expect(after.length).toBeGreaterThan(before.length);
    expect(labelsOf(after)).toContain('Reading the pages');
  });

  it('keeps row keys stable when the search stops running', () => {
    const trace = [...searchRun, reading, ev({ id: 6, type: 'done' })];
    const running = buildRows(true, trace, [], false).map((row) => row.key);
    const finished = buildRows(false, trace, [], false).map((row) => row.key);

    expect(finished).toEqual(running);
  });
});
