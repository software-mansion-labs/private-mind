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
    expect(labelsOf(rows)).toEqual(['Defining objectives', 'Done']);
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
      'Defining objectives',
      'Searching “warsaw weather”',
      'Done',
    ]);
  });

  it('falls back to the name as host when a result has no url', () => {
    const rows = buildRows(false, [], [src({ name: 'Local note' })], false);
    expect(hostsOf(rows)).toEqual(['Local note']);
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
      'Defining objectives',
      'Searching “cats”',
      'Searching the web',
    ]);
  });

  it('dedupes fetched/failed pages by host', () => {
    const rows = buildRows(
      true,
      [
        ev({ id: 1, type: 'fetched', host: 'a.com', url: 'https://a.com/1' }),
        ev({ id: 2, type: 'fetched', host: 'a.com', url: 'https://a.com/2' }),
        ev({ id: 3, type: 'failed', host: 'b.com', url: 'https://b.com/1' }),
      ],
      [],
      false
    );
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

  it('prefers finished results over the live page list once results arrive', () => {
    const trace = [
      ev({ id: 1, type: 'fetched', host: 'live.com', url: 'https://live.com' }),
    ];
    const rows = buildRows(
      true,
      trace,
      [src({ url: 'https://final.com/x' })],
      false
    );
    expect(hostsOf(rows)).toEqual(['final.com']);
  });
});
