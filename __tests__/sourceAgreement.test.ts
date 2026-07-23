import {
  analyzeSourceAgreement,
  registrableDomain,
  summarizeAgreement,
} from '../utils/web/sourceAgreement';
import { evaluateWebRetrieval } from '../utils/web/retrievalEvaluator';
import type { WebSearchResult } from '../utils/web/types';
import {
  WEB_AGREEMENT_SINGLE_HOST_FACTOR,
  WEB_EVAL_CONFIDENCE_HIGH,
} from '../constants/web';

const page = (
  url: string,
  text: string,
  content?: string
): WebSearchResult => ({
  title: url,
  url,
  snippet: text,
  ...(content ? { content } : {}),
});

describe('registrableDomain', () => {
  it('strips www and sub-domains down to the publisher', () => {
    expect(registrableDomain('https://www.bbc.co.uk/news/x')).toBe('bbc.co.uk');
    expect(registrableDomain('https://news.bbc.co.uk/x')).toBe('bbc.co.uk');
    expect(registrableDomain('https://example.com/a')).toBe('example.com');
  });

  it('treats language editions of one wiki as ONE source', () => {
    expect(registrableDomain('https://pl.wikipedia.org/wiki/Warszawa')).toBe(
      registrableDomain('https://en.wikipedia.org/wiki/Warsaw')
    );
  });

  it('keeps a country second-level domain intact', () => {
    expect(registrableDomain('https://sklep.firma.com.pl/x')).toBe(
      'firma.com.pl'
    );
  });

  it('falls back to the raw host on an unparseable URL', () => {
    expect(registrableDomain('not a url')).toBe('not a url');
  });
});

describe('analyzeSourceAgreement — publisher independence', () => {
  it('counts publishers, not pages', () => {
    const agreement = analyzeSourceAgreement([
      page('https://news.example.com/a', 'x'),
      page('https://sport.example.com/b', 'x'),
      page('https://other.org/c', 'x'),
    ]);
    expect(agreement.independentHosts).toBe(2);
    expect(agreement.repeatedHostResults).toBe(1);
  });
});

describe('analyzeSourceAgreement — corroboration', () => {
  it('marks a figure two independent publishers state as corroborated', () => {
    const agreement = analyzeSourceAgreement([
      page('https://a.com/x', 'The tower is 1,200 m tall.'),
      page('https://b.org/y', 'Height: 1200 m above sea level.'),
      page('https://c.net/z', 'Some unrelated 4500 m figure.'),
    ]);
    const corroborated = agreement.corroborated.find(
      (claim) => claim.value === '1200'
    );
    expect(corroborated?.hosts).toEqual(['a.com', 'b.org']);
    expect(
      agreement.singleSourced.some((claim) => claim.value === '4500')
    ).toBe(true);
  });

  it('does not let one publisher corroborate itself across pages', () => {
    const agreement = analyzeSourceAgreement([
      page('https://a.com/one', 'Price 250 usd'),
      page('https://a.com/two', 'Price 250 usd again'),
    ]);
    expect(agreement.corroborated).toHaveLength(0);
    expect(agreement.singleSourced[0].hosts).toEqual(['a.com']);
  });

  it('normalises locale number formats onto one claim', () => {
    const agreement = analyzeSourceAgreement([
      page('https://pl.example/x', 'Kurs wynosi 1 234,50 pln'),
      page('https://en.example/y', 'The rate is 1,234.50 PLN'),
    ]);
    expect(agreement.corroborated[0]).toMatchObject({
      value: '1234.5',
      unit: 'pln',
      hosts: ['en.example', 'pl.example'],
    });
  });

  it('drops bare small numbers as noise but keeps them with a unit', () => {
    const agreement = analyzeSourceAgreement([
      page('https://a.com/x', 'Step 3 of the guide, 7 km to go.'),
      page('https://b.com/y', 'Step 3 of the guide, 7 km to go.'),
    ]);
    const values = agreement.corroborated.map((claim) => claim.value);
    expect(values).toContain('7');
    expect(agreement.corroborated.find((c) => c.value === '7')?.unit).toBe(
      'km'
    );
    expect(
      [...agreement.corroborated, ...agreement.singleSourced].some(
        (claim) => claim.value === '3' && claim.unit === ''
      )
    ).toBe(false);
  });

  it('reads extracted content as well as the snippet', () => {
    const agreement = analyzeSourceAgreement([
      page('https://a.com/x', 'summary', 'Population is 800757 people.'),
      page('https://b.com/y', 'Population 800 757 residents.'),
    ]);
    expect(agreement.corroborated[0].value).toBe('800757');
  });

  it('reports a ratio over all salient claims and 0 when there are none', () => {
    const agreement = analyzeSourceAgreement([
      page('https://a.com/x', 'Height 1200 m and area 55 km'),
      page('https://b.com/y', 'Height 1200 m only'),
    ]);
    expect(agreement.agreementRatio).toBeCloseTo(0.5);
    expect(analyzeSourceAgreement([]).agreementRatio).toBe(0);
    expect(
      analyzeSourceAgreement([page('https://a.com/x', 'no figures here')])
        .agreementRatio
    ).toBe(0);
  });
});

describe('evaluateWebRetrieval — independence factor', () => {
  const strong = {
    resultCount: 4,
    contentCount: 3,
    retrieval: {
      embedded: true,
      chunkCount: 20,
      qualifiedCount: 6,
      distinctPages: 3,
      maxSimilarity: 0.9,
      topCoverage: 1,
    },
  };

  it('leaves confidence untouched with several publishers', () => {
    const many = analyzeSourceAgreement([
      page('https://a.com/x', 'x'),
      page('https://b.com/y', 'y'),
    ]);
    expect(
      evaluateWebRetrieval({ ...strong, agreement: many }).confidence
    ).toBe(evaluateWebRetrieval(strong).confidence);
  });

  it('nudges a single-publisher round down without vetoing it', () => {
    const one = analyzeSourceAgreement([
      page('https://a.com/x', 'x'),
      page('https://a.com/y', 'y'),
    ]);
    const base = evaluateWebRetrieval(strong).confidence;
    const nudged = evaluateWebRetrieval({ ...strong, agreement: one });
    expect(nudged.confidence).toBeCloseTo(
      base * WEB_AGREEMENT_SINGLE_HOST_FACTOR
    );
    expect(nudged.confidence).toBeGreaterThan(WEB_EVAL_CONFIDENCE_HIGH * 0.8);
  });

  it('cannot rescue a round that found nothing', () => {
    const agreement = analyzeSourceAgreement([]);
    expect(
      evaluateWebRetrieval({
        resultCount: 0,
        contentCount: 0,
        retrieval: null,
        agreement,
      }).confidence
    ).toBe(0);
  });
});

describe('summarizeAgreement — the line the user reads', () => {
  const summarize = (results: WebSearchResult[]) =>
    summarizeAgreement(analyzeSourceAgreement(results));

  it('flags an echo chamber outright', () => {
    expect(
      summarize([
        page('https://news.a.com/1', 'Height 1200 m'),
        page('https://blog.a.com/2', 'Height 1200 m'),
      ])
    ).toBe('All pages from one publisher');
  });

  it('counts the figures the publishers agree on', () => {
    expect(
      summarize([
        page('https://a.com/x', 'Height 1200 m, area 55 km'),
        page('https://b.com/y', 'Height 1200 m, area 55 km'),
        page('https://c.com/z', 'nothing numeric here'),
      ])
    ).toBe('2 matching figures');
  });

  it('uses the singular for a single agreed figure', () => {
    expect(
      summarize([
        page('https://a.com/x', 'Height 1200 m'),
        page('https://b.com/y', 'Height 1200 m'),
      ])
    ).toBe('1 matching figure');
  });

  it('says nothing when publishers differ but no figures line up', () => {
    expect(
      summarize([
        page('https://a.com/x', 'no numbers'),
        page('https://b.com/y', 'also none'),
      ])
    ).toBeNull();
  });

  it('says nothing at all with no usable sources', () => {
    expect(summarizeAgreement(analyzeSourceAgreement([]))).toBeNull();
  });
});
