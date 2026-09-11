import { isAllowedScrapeNavigation } from '../utils/web/security/scrapeNavigation';

describe('isAllowedScrapeNavigation', () => {
  it('allows about: urls (the idle source)', () => {
    expect(isAllowedScrapeNavigation('about:blank')).toBe(true);
  });

  it('allows the search-engine domains and their subdomains', () => {
    expect(
      isAllowedScrapeNavigation('https://html.duckduckgo.com/html/?q=x')
    ).toBe(true);
    expect(
      isAllowedScrapeNavigation('https://lite.duckduckgo.com/lite/?q=x')
    ).toBe(true);
    expect(isAllowedScrapeNavigation('https://www.mojeek.com/search?q=x')).toBe(
      true
    );
    expect(isAllowedScrapeNavigation('https://duckduckgo.com/')).toBe(true);
  });

  it('allows the CAPTCHA-provider domains', () => {
    expect(
      isAllowedScrapeNavigation('https://challenges.cloudflare.com/turnstile')
    ).toBe(true);
    expect(
      isAllowedScrapeNavigation('https://www.google.com/recaptcha/api.js')
    ).toBe(true);
    expect(
      isAllowedScrapeNavigation('https://www.gstatic.com/recaptcha/x')
    ).toBe(true);
    expect(isAllowedScrapeNavigation('https://newassets.hcaptcha.com/x')).toBe(
      true
    );
    expect(isAllowedScrapeNavigation('https://www.recaptcha.net/x')).toBe(true);
  });

  it('rejects arbitrary hosts and suffix-spoofing', () => {
    expect(isAllowedScrapeNavigation('https://evil.com/')).toBe(false);
    expect(isAllowedScrapeNavigation('https://duckduckgo.com.evil.com/')).toBe(
      false
    );
  });

  it('rejects non-http(s) schemes', () => {
    expect(
      isAllowedScrapeNavigation('data:text/html,<script>alert(1)</script>')
    ).toBe(false);
    expect(isAllowedScrapeNavigation('file:///etc/passwd')).toBe(false);
    expect(isAllowedScrapeNavigation(`${'java'}script:alert(1)`)).toBe(false);
  });

  it('rejects a malformed url', () => {
    expect(isAllowedScrapeNavigation('https://')).toBe(false);
  });
});
