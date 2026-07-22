import {
  webResultsToContext,
  hostname,
  selectRelevantContent,
} from '../utils/web/webResultsToContext';
import type { WebSearchResult } from '../utils/web/types';
import { SOURCE_HEADER } from '../constants/retrieval';
import { WEB_CONTENT_MAX_CHARS, WEB_SNIPPET_MAX_CHARS } from '../constants/web';

const result = (over: Partial<WebSearchResult> = {}): WebSearchResult => ({
  title: 'Example Title',
  url: 'https://www.example.com/path',
  snippet: 'A concise snippet.',
  ...over,
});

describe('webResultsToContext', () => {
  it('emits context strings that SOURCE_HEADER attributes back to the title', () => {
    const { context } = webResultsToContext([
      result({ title: 'Reanimated Docs' }),
    ]);
    expect(context).toHaveLength(1);
    const header = new RegExp(SOURCE_HEADER.source, 'g');
    const names = [...context[0].matchAll(header)].map((m) => m[1]);
    expect(names).toContain('Reanimated Docs');
  });

  it('produces web SourceDocuments carrying kind and url', () => {
    const { sourceDocuments } = webResultsToContext([
      result({ url: 'https://a.com/x' }),
    ]);
    expect(sourceDocuments[0]).toMatchObject({
      kind: 'web',
      url: 'https://a.com/x',
    });
  });

  it('truncates long snippets to the prompt-budget cap', () => {
    const long = 'x'.repeat(WEB_SNIPPET_MAX_CHARS + 200);
    const { sourceDocuments } = webResultsToContext([
      result({ snippet: long }),
    ]);
    expect(sourceDocuments[0].passage!.length).toBeLessThanOrEqual(
      WEB_SNIPPET_MAX_CHARS + 1
    );
    expect(sourceDocuments[0].passage!.endsWith('…')).toBe(true);
  });

  it('falls back to hostname when a result has no title', () => {
    const { sourceDocuments } = webResultsToContext([
      result({ title: '', url: 'https://www.foo.com/bar' }),
    ]);
    expect(sourceDocuments[0].name).toBe('foo.com');
  });

  it('attaches the search query to web sourceDocuments', () => {
    const { sourceDocuments } = webResultsToContext(
      [result(), result({ url: 'https://b.com/y' })],
      'weather in warsaw'
    );
    expect(sourceDocuments.every((d) => d.query === 'weather in warsaw')).toBe(
      true
    );
  });

  it('leaves query undefined when none is passed', () => {
    const { sourceDocuments } = webResultsToContext([result()]);
    expect(sourceDocuments[0].query).toBeUndefined();
  });

  it('returns empty arrays for no results', () => {
    expect(webResultsToContext([])).toEqual({
      context: [],
      sourceDocuments: [],
    });
  });

  it('grounds context on the snippet AND the extracted content (F1), keeping the snippet as the UI passage', () => {
    const { context, sourceDocuments } = webResultsToContext([
      result({
        snippet: 'Check the forecast for Warsaw.',
        content: 'Warszawa: obecnie 12°C, lekki deszcz, wiatr 15 km/h.',
      }),
    ]);
    expect(context[0]).toContain('obecnie 12°C');
    expect(context[0]).toContain('Check the forecast');
    expect(sourceDocuments[0].passage).toBe('Check the forecast for Warsaw.');
  });

  it('keeps the SERP snippet in context when enriched content omits the figure (F1)', () => {
    const { context } = webResultsToContext(
      [
        result({
          snippet: 'Kraków has a population of 800,757 (2023).',
          content:
            'Kraków is the second-largest city in Poland. History and culture section without the exact figure.',
        }),
      ],
      'Kraków population'
    );
    expect(context[0]).toContain('800,757');
  });

  it('selects the number-bearing passage over the boilerplate lead (F2)', () => {
    const filler = 'Kraków is a historic city with a long past. '.repeat(60);
    const fact =
      'The population of Kraków was 800,757 inhabitants as of 2023. ';
    const { context } = webResultsToContext(
      [result({ snippet: '', content: filler + fact + filler })],
      'Kraków population'
    );
    expect(context[0]).toContain('800,757');
  });

  it('caps enriched content to the content budget', () => {
    const long = 'y'.repeat(WEB_CONTENT_MAX_CHARS + 300);
    const { context } = webResultsToContext([result({ content: long })]);
    const yCount = (context[0].match(/y/g) ?? []).length;
    expect(yCount).toBeLessThanOrEqual(WEB_CONTENT_MAX_CHARS);
    expect(context[0]).toContain('…');
  });
});

describe('selectRelevantContent', () => {
  it('returns the whole text unchanged when it fits the budget', () => {
    const text = 'Short enough.';
    expect(selectRelevantContent(text, 'anything', 100)).toBe(text);
  });

  it('falls back to a leading truncation when no query is given', () => {
    const text = 'a'.repeat(50) + 'b'.repeat(50);
    const out = selectRelevantContent(text, undefined, 40);
    expect(out).toBe('a'.repeat(40) + '…');
  });

  it('falls back to a leading truncation when nothing matches the query', () => {
    const text = 'lorem ipsum dolor sit amet. '.repeat(20);
    const out = selectRelevantContent(text, 'kraków population', 60);
    expect(out.length).toBeLessThanOrEqual(61);
    expect(out.endsWith('…')).toBe(true);
  });

  it('prefers passages containing query keywords over off-topic ones', () => {
    const off = 'The weather in the mountains is pleasant today. '.repeat(10);
    const hit = 'Kraków is a major Polish city. ';
    const out = selectRelevantContent(off + hit + off, 'Kraków', 120);
    expect(out).toContain('Kraków');
  });

  it('prefers a passage with digits when the query is about a figure', () => {
    const prose =
      'The city has a rich history spanning many centuries of culture. '.repeat(
        8
      );
    const number = 'Its population reached 800757 residents in 2023. ';
    const out = selectRelevantContent(
      prose + number + prose,
      'population',
      120
    );
    expect(out).toContain('800757');
  });

  it('stays within the character budget', () => {
    const text = 'Kraków population data point. '.repeat(100);
    const out = selectRelevantContent(text, 'Kraków population', 200);
    expect(out.length).toBeLessThanOrEqual(200);
  });

  it('matches inflected Polish query terms against the page text', () => {
    const off = 'W górach bywa zmiennie o każdej porze roku. '.repeat(10);
    const hit = 'Sardynia we wrześniu ma temperatury około 25 stopni. ';
    const out = selectRelevantContent(
      off + hit + off,
      'pogoda na Sardynii',
      60
    );
    expect(out).toContain('Sardynia');
  });

  it('treats newline-separated lines without punctuation as separate passages', () => {
    const nav = Array.from(
      { length: 30 },
      () => 'Home About Contact Products'
    ).join('\n');
    const fact = 'Population 800757';
    const out = selectRelevantContent(
      `${nav}\n${fact}\n${nav}`,
      'population',
      60
    );
    expect(out).toContain('800757');
    expect(out.length).toBeLessThanOrEqual(60);
  });
});

describe('hostname', () => {
  it('strips protocol and www', () => {
    expect(hostname('https://www.example.com/a/b')).toBe('example.com');
  });

  it('returns the input unchanged on a malformed url', () => {
    expect(hostname('not a url')).toBe('not a url');
  });
});
