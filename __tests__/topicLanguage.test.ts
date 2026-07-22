import {
  detectTopicLanguage,
  nativeTitleQuery,
} from '../utils/web/topicLanguage';
import type { WebSearchResult } from '../utils/web/types';

const page = (url: string, title = 'Title'): WebSearchResult => ({
  title,
  url,
  snippet: '',
});

describe('detectTopicLanguage', () => {
  it('reads the topic language off ccTLDs', () => {
    const out = detectTopicLanguage([
      page('https://duomodicagliari.it/'),
      page('https://cagliariturismo.comune.cagliari.it/'),
    ]);
    expect(out).toEqual({ code: 'it', name: 'Italian' });
  });

  it('reads a Wikipedia language subdomain even on a generic domain', () => {
    const out = detectTopicLanguage([
      page('https://it.wikipedia.org/wiki/Cagliari'),
      page('https://it.wikivoyage.org/wiki/Cagliari'),
    ]);
    expect(out).toEqual({ code: 'it', name: 'Italian' });
  });

  it('reads the mobile Wikipedia subdomain the in-app WebView tends to get', () => {
    const out = detectTopicLanguage([
      page('https://it.m.wikipedia.org/wiki/Cagliari'),
      page('https://it.m.wikipedia.org/wiki/Sardegna'),
    ]);
    expect(out).toEqual({ code: 'it', name: 'Italian' });
  });

  it('maps ccTLDs that differ from the language code', () => {
    expect(
      detectTopicLanguage([page('https://a.cz/'), page('https://b.cz/')])
    ).toEqual({ code: 'cs', name: 'Czech' });
    expect(
      detectTopicLanguage([page('https://a.at/'), page('https://b.de/')])
    ).toEqual({ code: 'de', name: 'German' });
  });

  it('ignores a single stray foreign host', () => {
    expect(
      detectTopicLanguage([
        page('https://example.com/'),
        page('https://other.org/'),
        page('https://stray.it/'),
      ])
    ).toBeNull();
  });

  it('says nothing for language-neutral hosts', () => {
    expect(
      detectTopicLanguage([
        page('https://example.com/'),
        page('https://en.wikipedia.org/wiki/X'),
        page('https://foo.io/'),
      ])
    ).toBeNull();
  });

  it('never reports English — it is the pivot, not a language to switch to', () => {
    expect(
      detectTopicLanguage([
        page('https://en.wikipedia.org/wiki/A'),
        page('https://en.wikipedia.org/wiki/B'),
      ])
    ).toBeNull();
  });

  it('picks the plurality when hosts disagree', () => {
    expect(
      detectTopicLanguage([
        page('https://a.it/'),
        page('https://b.de/'),
        page('https://c.it/'),
      ])
    ).toEqual({ code: 'it', name: 'Italian' });
  });
});

describe('nativeTitleQuery', () => {
  const italian = { code: 'it', name: 'Italian' };

  it('lifts the entity name verbatim from a page in the topic language', () => {
    const out = nativeTitleQuery(
      [
        page('https://example.com/', 'Cagliari Cathedral'),
        page(
          'https://it.wikipedia.org/wiki/X',
          'Cattedrale di Santa Maria (Cagliari) - Wikipedia'
        ),
      ],
      italian
    );
    expect(out).toBe('Cattedrale di Santa Maria (Cagliari)');
  });

  it('skips pages that are not in the topic language', () => {
    expect(
      nativeTitleQuery(
        [page('https://example.com/', 'A long enough title')],
        italian
      )
    ).toBe('');
  });

  it('rejects titles too short or too long to be a query', () => {
    expect(nativeTitleQuery([page('https://a.it/', 'ok')], italian)).toBe('');
    expect(
      nativeTitleQuery([page('https://a.it/', 'x'.repeat(120))], italian)
    ).toBe('');
  });

  it('returns empty when nothing qualifies', () => {
    expect(nativeTitleQuery([], italian)).toBe('');
  });
});
