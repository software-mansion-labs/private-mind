import type { WebSearchResult } from './types';
import { hostname } from './webResultsToContext';

export interface TopicLanguage {
  code: string;
  name: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  it: 'Italian',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese',
  nl: 'Dutch',
  pl: 'Polish',
  cs: 'Czech',
  sv: 'Swedish',
  no: 'Norwegian',
  da: 'Danish',
  fi: 'Finnish',
  el: 'Greek',
  tr: 'Turkish',
  ru: 'Russian',
  uk: 'Ukrainian',
  ja: 'Japanese',
  zh: 'Chinese',
  ko: 'Korean',
};

const TLD_TO_LANGUAGE: Record<string, string> = {
  it: 'it',
  de: 'de',
  at: 'de',
  ch: 'de',
  fr: 'fr',
  es: 'es',
  pt: 'pt',
  br: 'pt',
  nl: 'nl',
  be: 'nl',
  pl: 'pl',
  cz: 'cs',
  se: 'sv',
  no: 'no',
  dk: 'da',
  fi: 'fi',
  gr: 'el',
  tr: 'tr',
  ru: 'ru',
  ua: 'uk',
  jp: 'ja',
  cn: 'zh',
  kr: 'ko',
};

const languageOfHost = (host: string): string | null => {
  const wiki =
    /^([a-z]{2})(?:\.m)?\.(wikipedia|wikivoyage|wiktionary)\.org$/.exec(host);
  const code = wiki
    ? wiki[1]!
    : (TLD_TO_LANGUAGE[host.split('.').pop() ?? ''] ?? '');
  return LANGUAGE_NAMES[code] ? code : null;
};

export const detectTopicLanguage = (
  results: WebSearchResult[]
): TopicLanguage | null => {
  const counts = new Map<string, number>();
  for (const result of results) {
    if (!result.url) continue;
    const code = languageOfHost(hostname(result.url));
    if (!code) continue;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  if (!best || bestCount < 2) return null;
  return { code: best, name: LANGUAGE_NAMES[best]! };
};

const TITLE_TAIL = /\s*[-—|·]\s*[^-—|·]{1,40}$/;

export const nativeTitleQuery = (
  results: WebSearchResult[],
  language: TopicLanguage
): string => {
  for (const result of results) {
    if (!result.url || !result.title) continue;
    if (languageOfHost(hostname(result.url)) !== language.code) continue;
    const title = result.title.replace(TITLE_TAIL, '').trim();
    if (title.length < 4 || title.length > 90) continue;
    return title.replace(/\s+/g, ' ');
  }
  return '';
};
