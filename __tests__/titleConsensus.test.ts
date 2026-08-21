import { promoteTitleConsensus } from '../utils/web/titleConsensus';
import type { WebSearchResult } from '../utils/web/types';

const page = (
  url: string,
  title: string,
  content?: string
): WebSearchResult => ({
  url,
  title,
  snippet: 's',
  ...(content ? { content } : {}),
});

const QUERY = 'Kto jest premierem Wielkiej Brytanii?';
const BODY = 'long enough body text to count as read '.repeat(3);

describe('promoteTitleConsensus', () => {
  it('promotes the read page whose title carries the cross-host consensus entity', () => {
    const results = [
      page(
        'https://taniabrytania.uk/premierzy',
        'Premierzy UK, czyli chronologiczna lista premierów Wielkiej Brytanii',
        BODY
      ),
      page(
        'https://pl.wikipedia.org/wiki/Premier',
        'Premier Wielkiej Brytanii - Wikipedia, wolna encyklopedia',
        BODY
      ),
      page(
        'https://polskiobserwator.uk/burnham',
        'Andy Burnham nowym premierem Wielkiej Brytanii. Kim jest i jak rządził',
        BODY
      ),
      page(
        'https://www.fakt.pl/burnham',
        'Andy Burnham to nowy brytyjski premier. Kim jest Król Północy'
      ),
      page(
        'https://pl.euronews.com/burnham',
        'Nowy premier Wielkiej Brytanii Andy Burnham zapowiada 10-letni plan'
      ),
    ];

    const out = promoteTitleConsensus(results, QUERY);

    expect(out[0]!.url).toBe('https://polskiobserwator.uk/burnham');
    expect(out.slice(1).map((r) => r.url)).toEqual([
      'https://taniabrytania.uk/premierzy',
      'https://pl.wikipedia.org/wiki/Premier',
      'https://www.fakt.pl/burnham',
      'https://pl.euronews.com/burnham',
    ]);
  });

  it('leaves the order alone when no entity spans two hosts', () => {
    const results = [
      page('https://onet.pl/pogoda', 'Pogoda Gdańsk - prognoza na dziś', BODY),
      page(
        'https://interia.pl/pogoda',
        'Długoterminowa prognoza dla Trójmiasta',
        BODY
      ),
      page('https://wp.pl/pogoda', 'Sprawdź, czy jutro będzie padać', BODY),
    ];
    expect(promoteTitleConsensus(results, 'pogoda Gdańsk jutro')).toEqual(
      results
    );
  });

  it('never counts the question own words as a consensus entity', () => {
    const results = [
      page('https://a.example/1', 'Historia Wielkiej Brytanii w pigułce', BODY),
      page('https://b.example/2', 'Gospodarka Wielkiej Brytanii dzisiaj', BODY),
      page(
        'https://c.example/3',
        'Wielkiej Brytanii przewodnik turystyczny',
        BODY
      ),
    ];
    expect(promoteTitleConsensus(results, QUERY)).toEqual(results);
  });

  it('treats two articles from one outlet as one voice', () => {
    const results = [
      page('https://neutral.example/x', 'Przegląd tygodnia w polityce', BODY),
      page('https://www.fakt.pl/a', 'Andy Burnham obiecuje zmiany', BODY),
      page('https://fakt.pl/b', 'Andy Burnham w Manchesterze'),
    ];
    expect(promoteTitleConsensus(results, QUERY)).toEqual(results);
  });

  it('does not move anything when the consensus page is already first', () => {
    const results = [
      page('https://a.example/1', 'Andy Burnham nowym premierem', BODY),
      page('https://b.example/2', 'Andy Burnham przejmuje urząd', BODY),
      page('https://c.example/3', 'Lista premierów', BODY),
    ];
    expect(promoteTitleConsensus(results, QUERY)).toEqual(results);
  });

  it('only promotes a page that was actually read, while unopened listings still vote', () => {
    const results = [
      page('https://stale.example/1', 'Lista premierów kraju', BODY),
      page('https://a.example/2', 'Andy Burnham nowym premierem'),
      page('https://b.example/3', 'Andy Burnham przejmuje urząd', BODY),
      page('https://c.example/4', 'Andy Burnham w Londynie'),
    ];

    const out = promoteTitleConsensus(results, QUERY);

    expect(out[0]!.url).toBe('https://b.example/3');
  });

  it('ignores a lone capitalized word that merely opens a title', () => {
    const results = [
      page('https://a.example/1', 'Przegląd wydarzeń dnia', BODY),
      page('https://b.example/2', 'Nowy sezon rozgrywek rusza', BODY),
      page('https://c.example/3', 'Nowy rozdział w negocjacjach', BODY),
    ];
    expect(promoteTitleConsensus(results, 'wyniki rozgrywek')).toEqual(results);
  });

  it('counts a lone surname mid-title', () => {
    const results = [
      page('https://stale.example/1', 'Lista kanclerzy w historii', BODY),
      page('https://a.example/2', 'Kim jest Merz naprawdę', BODY),
      page('https://b.example/3', 'Co planuje Merz po wyborze'),
    ];

    const out = promoteTitleConsensus(results, 'kto jest kanclerzem Niemiec');

    expect(out[0]!.url).toBe('https://a.example/2');
  });

  it('does not let entity-only profile pages vote the outgoing officeholder first', () => {
    const results = [
      page(
        'https://en.wikipedia.org/wiki/PM',
        'Prime Minister of the United Kingdom - Wikipedia',
        BODY
      ),
      page(
        'https://en.wikipedia.org/wiki/KS',
        'Keir Starmer - Wikipedia',
        BODY
      ),
      page(
        'https://www.gov.uk/government/ministers/prime-minister',
        'Keir Starmer - GOV.UK',
        BODY
      ),
      page(
        'https://www.npr.org/burnham',
        'What to know about Andy Burnham, new U.K. prime minister : NPR',
        BODY
      ),
    ];

    const out = promoteTitleConsensus(
      results,
      'Who is the prime minister of the United Kingdom?'
    );

    expect(out).toEqual(results);
  });

  it('still counts an entity asserted about in a branded title', () => {
    const results = [
      page('https://stale.example/1', 'Lista premierów kraju', BODY),
      page(
        'https://a.example/2',
        'Andy Burnham przejął urząd premiera - Wiadomości',
        BODY
      ),
      page(
        'https://b.example/3',
        'What to know about Andy Burnham, new prime minister : NPR'
      ),
    ];

    const out = promoteTitleConsensus(results, QUERY);

    expect(out[0]!.url).toBe('https://a.example/2');
  });

  it('is a no-op for caseless scripts and untitled results', () => {
    const zh = [
      page('https://a.example/1', '德国总理是谁', BODY),
      page('https://b.example/2', '德国总理最新消息', BODY),
    ];
    expect(promoteTitleConsensus(zh, '德国总理是谁')).toEqual(zh);

    const untitled = [
      { url: 'https://a.example/1', title: '', snippet: 's', content: BODY },
      { url: 'https://b.example/2', title: '', snippet: 's', content: BODY },
    ];
    expect(promoteTitleConsensus(untitled, QUERY)).toEqual(untitled);
  });
});
