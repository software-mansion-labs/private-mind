import {
  SERP_PARSER_JS,
  parseSerpMessage,
  type SerpMessage,
} from '../utils/web/scrape/serpParser';

interface El {
  sel: string[];
  href?: string;
  innerText?: string;
  className?: string;
  children?: El[];
  rows?: El[];
}

const matches = (el: El, selector: string): boolean =>
  selector
    .split(',')
    .map((part) => part.trim())
    .some((part) => el.sel.includes(part));

const queryFirst = (list: El[], selector: string): unknown =>
  list.find((el) => matches(el, selector)) ?? null;

const wire = (el: El): El => {
  const children = (el.children ?? []).map(wire);
  const rows = el.rows ?? [];
  return {
    ...el,
    children,
    querySelector: (selector: string) => queryFirst(children, selector),
    closest: (selector: string) =>
      selector === 'tr' && rows.length ? rows[0] : null,
  } as El & Record<string, unknown>;
};

const chain = (rows: El[]): El[] => {
  const wired = rows.map((row) => {
    const children = (row.children ?? []).map(wire);
    return {
      ...row,
      children,
      querySelector: (selector: string) => queryFirst(children, selector),
    } as El & Record<string, unknown>;
  });
  wired.forEach((row, index) => {
    (row as Record<string, unknown>).nextElementSibling =
      wired[index + 1] ?? null;
  });
  return wired;
};

const runParser = (nodes: El[], bodyText = ''): SerpMessage[] => {
  const posted: string[] = [];
  const all = nodes;
  const window = {
    ReactNativeWebView: {
      postMessage: (message: string) => posted.push(message),
    },
  };
  const document = {
    title: '',
    body: { innerText: bodyText },
    querySelectorAll: (selector: string) =>
      all.filter((el) => matches(el, selector)),
    querySelector: () => null,
  };

  // eslint-disable-next-line no-new-func
  new Function('window', 'document', SERP_PARSER_JS)(window, document);

  return posted
    .map(parseSerpMessage)
    .filter((message): message is SerpMessage => message !== null);
};

const resultsOf = (messages: SerpMessage[]) =>
  messages[0]?.type === 'serp-results' ? messages[0].results : [];

describe('SERP parser — layout ladder', () => {
  it('reads the DuckDuckGo /lite/ table layout, snippet from the next row', () => {
    const snippetRow = {
      sel: [],
      children: [{ sel: ['.result-snippet'], innerText: 'Lite snippet text' }],
    };
    const rows = chain([{ sel: [] }, snippetRow]);
    const link = wire({
      sel: ['a.result-link', 'a[href]'],
      href: '//duckduckgo.com/l/?uddg=https%3A%2F%2Flite.example%2Fpage',
      innerText: 'Lite result',
      rows,
    });

    const results = resultsOf(runParser([link]));

    expect(results).toEqual([
      {
        title: 'Lite result',
        url: 'https://lite.example/page',
        snippet: 'Lite snippet text',
      },
    ]);
  });

  it('reads the Mojeek list layout', () => {
    const item = wire({
      sel: ['ul.results-standard li'],
      children: [
        {
          sel: ['h2 a', 'a'],
          href: 'https://mojeek-hit.example/',
          innerText: 'Mojeek result',
        },
        { sel: ['p.s'], innerText: 'Independent index snippet' },
      ],
    });

    const results = resultsOf(runParser([item]));

    expect(results).toEqual([
      {
        title: 'Mojeek result',
        url: 'https://mojeek-hit.example/',
        snippet: 'Independent index snippet',
      },
    ]);
  });

  it('falls back to plain anchors when every known selector is gone', () => {
    const anchor = (href: string, innerText: string): El =>
      wire({ sel: ['a[href]'], href, innerText });

    const results = resultsOf(
      runParser([
        anchor('https://duckduckgo.com/settings', 'Settings'),
        anchor('https://example.com/short', 'Next'),
        anchor('https://real-result.example/', 'A genuine headline of a page'),
      ])
    );

    expect(results).toEqual([
      {
        title: 'A genuine headline of a page',
        url: 'https://real-result.example/',
        snippet: '',
      },
    ]);
  });

  it('prefers a structured layout over the generic fallback', () => {
    const card = wire({
      sel: ['div.result'],
      children: [
        {
          sel: ['a.result__a'],
          href: 'https://card.example/',
          innerText: 'Card',
        },
        { sel: ['.result__snippet'], innerText: 'Card snippet' },
      ],
    });
    const stray = wire({
      sel: ['a[href]'],
      href: 'https://stray.example/',
      innerText: 'A long stray anchor label',
    });

    const results = resultsOf(runParser([card, stray]));

    expect(results).toHaveLength(1);
    expect(results[0]!.url).toBe('https://card.example/');
  });

  it('still reports a bot-wall when no rung finds anything', () => {
    const messages = runParser([], 'Just a moment... checking your browser');
    expect(messages).toEqual([{ type: 'serp-challenge' }]);
  });
});
