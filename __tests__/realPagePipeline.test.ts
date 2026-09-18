import { gunzipSync } from 'zlib';
import { readFileSync } from 'fs';
import { join } from 'path';
import { heuristicExtractText } from '../utils/web/url/extractArticle';
import { selectRelevantContent } from '../utils/web/webResultsToContext';
import { looksLikeHistoricalRoster } from '../utils/web/listingRelevance';
import { WEB_CONTENT_MIN_CHARS } from '../constants/web';

const PAGES = join(__dirname, 'fixtures', 'pages');

const page = (file: string): string =>
  gunzipSync(readFileSync(join(PAGES, file))).toString('utf8');

const contextFor = (file: string, query: string, title: string): string =>
  selectRelevantContent(heuristicExtractText(page(file)), query, 4000, {
    title,
  });

describe('a list question answered from prose', () => {
  const COMPONENTS = [
    'bacon',
    'sausage',
    'egg',
    'tomato',
    'mushroom',
    'pudding',
    'beans',
  ];

  it('hands the model the components, not the history of the dish', () => {
    const context = contextFor(
      'full-breakfast.html.gz',
      'What are the ingredients for a full English breakfast',
      'Full breakfast - Wikipedia'
    ).toLowerCase();

    const found = COMPONENTS.filter((item) => context.includes(item));
    expect(found.length).toBeGreaterThanOrEqual(5);
  });
});

describe('the roster page the device answered from', () => {
  const TITLE =
    'Presidenti del Consiglio dei ministri della Repubblica Italiana';

  it('carries the names of long-gone holders right beside the current one', () => {
    const context = contextFor(
      'it-roster.html.gz',
      'Chi e attualmente il presidente del consiglio italiano',
      TITLE
    );

    expect(context).toContain('Tambroni');
    expect(context).toContain('in carica');
  });

  it('is not recognised as a roster, because its title names no year', () => {
    expect(looksLikeHistoricalRoster(TITLE)).toBe(false);
  });
});

describe('a page whose body is rendered in the browser', () => {
  it('passes the minimum-content gate while carrying no answer at all', () => {
    const text = heuristicExtractText(page('de-kanzler.html.gz'));

    expect(text.length).toBeGreaterThan(WEB_CONTENT_MIN_CHARS);
    expect(text.toLowerCase()).not.toContain('bundeskanzler ist');
    expect(text.length).toBeLessThan(1500);
  });
});
