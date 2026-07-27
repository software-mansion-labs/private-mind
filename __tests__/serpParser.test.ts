import {
  SERP_PARSER_JS,
  SERP_PARSER_JS_ONLOAD,
  buildSerpParserJs,
} from '../utils/web/scrape/serpParser';
import {
  parseSerpMessage,
  type SerpMessage,
} from '../utils/web/security/untrustedContent';

interface FakeNode {
  querySelector: (selector: string) => unknown;
}

const makeResultNode = (
  title: string,
  href: string,
  snippet: string
): FakeNode => ({
  querySelector: (selector: string) => {
    if (selector.includes('result__a')) {
      return { href, innerText: title, textContent: title };
    }
    if (selector.includes('result__snippet')) {
      return { innerText: snippet, textContent: snippet };
    }
    return null;
  },
});

const runParser = (dom: {
  results?: FakeNode[];
  bodyText?: string;
  title?: string;
  challengeElement?: boolean;
}): SerpMessage[] => {
  const posted: string[] = [];
  const window = {
    ReactNativeWebView: {
      postMessage: (message: string) => posted.push(message),
    },
  };
  const document = {
    title: dom.title ?? '',
    body: { innerText: dom.bodyText ?? '' },
    querySelectorAll: () => dom.results ?? [],
    querySelector: () => (dom.challengeElement ? {} : null),
  };

  // eslint-disable-next-line no-new-func
  const run = new Function('window', 'document', SERP_PARSER_JS);
  run(window, document);

  return posted
    .map(parseSerpMessage)
    .filter((message): message is SerpMessage => message !== null);
};

describe('SERP_PARSER_JS classification', () => {
  it('reports results for a normal SERP', () => {
    const messages = runParser({
      results: [
        makeResultNode('Example', 'https://example.com', 'A snippet'),
        makeResultNode('Other', 'https://other.com', 'Another'),
      ],
      bodyText: 'Example Other',
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      type: 'serp-results',
      results: [
        { title: 'Example', url: 'https://example.com', snippet: 'A snippet' },
        { title: 'Other', url: 'https://other.com', snippet: 'Another' },
      ],
    });
  });

  it('does NOT flag a challenge when results mention captcha/cloudflare', () => {
    const messages = runParser({
      results: [
        makeResultNode(
          'Which sites resist web scraping?',
          'https://example.com/scraping',
          'Cloudflare and CAPTCHA walls block bots; are you a robot checks are common.'
        ),
      ],
      bodyText:
        'Which sites resist web scraping? Cloudflare and CAPTCHA walls block bots. Are you a robot?',
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('serp-results');
  });

  it('flags a challenge when there are no results and the title is a bot-wall', () => {
    const messages = runParser({
      results: [],
      title: 'Just a moment...',
      bodyText: 'Checking your browser before accessing duckduckgo.com',
    });

    expect(messages).toEqual([{ type: 'serp-challenge' }]);
  });

  it('flags a challenge on a structural marker even without tell-tale text', () => {
    const messages = runParser({
      results: [],
      bodyText: '',
      challengeElement: true,
    });

    expect(messages).toEqual([{ type: 'serp-challenge' }]);
  });

  it('reports an empty result set for a genuinely empty SERP', () => {
    const messages = runParser({
      results: [],
      bodyText: 'No results found for that query.',
    });

    expect(messages).toEqual([{ type: 'serp-results', results: [] }]);
  });

  it('unwraps the DuckDuckGo /l/?uddg= redirect into the real destination', () => {
    const messages = runParser({
      results: [
        makeResultNode(
          'Wrapped',
          'https://duckduckgo.com/l/?uddg=https%3A%2F%2Freal.example.com%2Fpage&rut=abc',
          'snippet'
        ),
      ],
    });

    expect(messages[0]).toMatchObject({
      type: 'serp-results',
      results: [{ url: 'https://real.example.com/page' }],
    });
  });

  it('drops duplicate URLs', () => {
    const messages = runParser({
      results: [
        makeResultNode('One', 'https://dup.example.com', 'a'),
        makeResultNode('Two', 'https://dup.example.com', 'b'),
      ],
    });

    expect(messages[0]).toMatchObject({
      type: 'serp-results',
      results: [{ title: 'One' }],
    });
  });
});

describe('parseSerpMessage — trust boundary', () => {
  const msg = (results: unknown[]): string =>
    JSON.stringify({ type: 'serp-results', results });

  it('rejects results whose url is not http(s)', () => {
    const parsed = parseSerpMessage(
      msg([
        { title: 'Local file', url: 'file:///etc/passwd' },
        { title: 'Weird scheme', url: `${'java'}script:alert(1)` },
        { title: 'Real', url: 'https://example.com/a' },
      ])
    ) as Extract<SerpMessage, { type: 'serp-results' }>;
    expect(parsed.results.map((r) => r.url)).toEqual(['https://example.com/a']);
  });

  it('caps the result count and truncates oversized fields', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      title: 'T'.repeat(500),
      url: `https://example.com/${i}`,
      snippet: 'S'.repeat(5000),
    }));
    const parsed = parseSerpMessage(msg(many)) as Extract<
      SerpMessage,
      { type: 'serp-results' }
    >;
    expect(parsed.results.length).toBeLessThanOrEqual(20);
    expect(parsed.results[0]!.title.length).toBeLessThanOrEqual(300);
    expect(parsed.results[0]!.snippet.length).toBeLessThanOrEqual(1000);
  });

  it('rejects an oversized raw message before parsing', () => {
    expect(
      parseSerpMessage(
        msg([{ title: 'x'.repeat(600_000), url: 'https://x.com' }])
      )
    ).toBeNull();
  });

  it('collapses whitespace in a title so the source header stays one line', () => {
    const parsed = parseSerpMessage(
      msg([{ title: 'Multi\n  line\ttitle', url: 'https://x.com' }])
    ) as Extract<SerpMessage, { type: 'serp-results' }>;
    expect(parsed.results[0]!.title).toBe('Multi line title');
  });
});

describe('buildSerpParserJs — empty-result reporting', () => {
  const EMPTY_POST = "post({ type: 'serp-results', results: [] });";

  it('the recheck variant reports an empty result set', () => {
    expect(SERP_PARSER_JS).toContain(EMPTY_POST);
    expect(buildSerpParserJs(true)).toContain(EMPTY_POST);
  });

  it('the on-load variant never settles an engine with an empty result set', () => {
    expect(SERP_PARSER_JS_ONLOAD).not.toContain(EMPTY_POST);
    expect(buildSerpParserJs(false)).not.toContain(EMPTY_POST);
  });

  it('checks for a challenge before the generic link fallback', () => {
    const challengeIdx = SERP_PARSER_JS.indexOf("type: 'serp-challenge'");
    const genericIdx = SERP_PARSER_JS.indexOf("querySelectorAll('a[href]')");
    expect(challengeIdx).toBeGreaterThan(-1);
    expect(genericIdx).toBeGreaterThan(-1);
    expect(challengeIdx).toBeLessThan(genericIdx);
  });
});
