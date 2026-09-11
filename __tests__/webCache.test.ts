import {
  TtlCache,
  clearWebCaches,
  pageCache,
  serpCache,
} from '../utils/web/cache/webCache';
import { WEB_CACHE_TTL_MS, WEB_PAGE_CACHE_MAX_CHARS } from '../constants/web';

beforeEach(() => {
  jest.useFakeTimers();
  clearWebCaches();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('TtlCache', () => {
  it('returns a stored value and forgets it once the ttl passes', () => {
    const cache = new TtlCache<string>(10, 1000);
    cache.set('k', 'v');

    expect(cache.get('k')).toBe('v');
    jest.advanceTimersByTime(999);
    expect(cache.get('k')).toBe('v');
    jest.advanceTimersByTime(2);
    expect(cache.get('k')).toBeUndefined();
  });

  it('evicts the least recently used entry, not the oldest one', () => {
    const cache = new TtlCache<string>(2, 1000);
    cache.set('a', 'A');
    cache.set('b', 'B');
    expect(cache.get('a')).toBe('A');
    cache.set('c', 'C');

    expect(cache.get('a')).toBe('A');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe('C');
  });

  it('bounds itself by cost, so a few long pages cannot pile up', () => {
    const cache = new TtlCache<string>(100, 1000);
    cache.set('a', 'A', 60);
    cache.set('b', 'B', 60);

    expect(cache.totalCost).toBe(60);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('B');
  });

  it('refuses an entry larger than the whole budget instead of emptying itself', () => {
    const cache = new TtlCache<string>(100, 1000);
    cache.set('keeper', 'K', 50);
    cache.set('monster', 'M', 500);

    expect(cache.get('monster')).toBeUndefined();
    expect(cache.get('keeper')).toBe('K');
  });

  it('drops an expired entry from the cost budget, not just from lookups', () => {
    const cache = new TtlCache<string>(100, 1000);
    cache.set('a', 'A', 90);
    jest.advanceTimersByTime(1001);
    expect(cache.get('a')).toBeUndefined();

    cache.set('b', 'B', 90);
    expect(cache.get('b')).toBe('B');
  });
});

describe('the shared web caches', () => {
  it('sizes the page cache in characters and the serp cache in entries', () => {
    const text = 'x'.repeat(WEB_PAGE_CACHE_MAX_CHARS);
    pageCache.set(
      'https://a.example/',
      { url: 'https://a.example/', title: 'A', text, siteName: 'a.example' },
      text.length
    );
    serpCache.set('warsaw weather', [
      { title: 'W', url: 'https://a.example/', snippet: '' },
    ]);

    expect(pageCache.get('https://a.example/')?.text).toHaveLength(
      WEB_PAGE_CACHE_MAX_CHARS
    );
    expect(serpCache.get('warsaw weather')).toHaveLength(1);

    jest.advanceTimersByTime(WEB_CACHE_TTL_MS + 1);
    expect(pageCache.get('https://a.example/')).toBeUndefined();
    expect(serpCache.get('warsaw weather')).toBeUndefined();
  });
});
