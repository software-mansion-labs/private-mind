import { detectUrls, isSingleUrl } from '../utils/web/url/urlDetection';

describe('detectUrls', () => {
  it('finds http and https urls in prose', () => {
    expect(detectUrls('see https://a.com and http://b.org/x here')).toEqual([
      'https://a.com',
      'http://b.org/x',
    ]);
  });

  it('trims trailing sentence punctuation', () => {
    expect(detectUrls('read https://a.com/page.')).toEqual([
      'https://a.com/page',
    ]);
  });

  it('dedupes repeated urls', () => {
    expect(detectUrls('https://a.com https://a.com')).toEqual([
      'https://a.com',
    ]);
  });

  it('returns empty for text without urls', () => {
    expect(detectUrls('no links here')).toEqual([]);
  });
});

describe('isSingleUrl', () => {
  it('is true when the trimmed input is exactly one url', () => {
    expect(isSingleUrl('  https://a.com/x  ')).toBe(true);
  });

  it('is false when there is surrounding text', () => {
    expect(isSingleUrl('go to https://a.com')).toBe(false);
  });

  it('is false for multiple urls', () => {
    expect(isSingleUrl('https://a.com https://b.com')).toBe(false);
  });
});
