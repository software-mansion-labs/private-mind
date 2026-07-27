import { SCRAPE_ENGINES } from '../../../constants/web';
import { isHttpUrl } from './outboundFetch';

const ENGINE_DOMAINS = Array.from(
  new Set(
    SCRAPE_ENGINES.map((engine) => {
      try {
        return new URL(engine.url).hostname
          .split('.')
          .slice(-2)
          .join('.')
          .toLowerCase();
      } catch {
        return '';
      }
    }).filter(Boolean)
  )
);

const CHALLENGE_DOMAINS = [
  'cloudflare.com',
  'hcaptcha.com',
  'recaptcha.net',
  'google.com',
  'gstatic.com',
];

const ALLOWED_NAV_DOMAINS = [...ENGINE_DOMAINS, ...CHALLENGE_DOMAINS];

export const isAllowedScrapeNavigation = (url: string): boolean => {
  if (url.startsWith('about:')) return true;
  if (!isHttpUrl(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_NAV_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
};
