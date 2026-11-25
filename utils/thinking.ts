import { THINK_CLOSE, THINK_OPEN } from '../constants/citations';
import {
  extractQueryTerms,
  foldForMatching,
  segmentUnsegmentedScripts,
  stemPrefix,
} from './queryTerms';

export interface ThinkingParts {
  normalContent: string;
  thinkingContent: string | null;
  hasThinking: boolean;
  isThinkingComplete?: boolean;
  normalAfterThink?: string;
}

const normalizeThinkMarkup = (text: string): string => {
  const close = text.indexOf(THINK_CLOSE);
  if (close === -1) return text;

  const open = text.indexOf(THINK_OPEN);
  if (open !== -1 && open < close) return text;

  return `${THINK_OPEN}${text}`;
};

export const withTemplateThinkOpener = (text: string): string =>
  text.startsWith(THINK_OPEN) ? text : `${THINK_OPEN}${text}`;

export const hasUnclosedThink = (text: string): boolean =>
  text.split(THINK_OPEN).length > text.split(THINK_CLOSE).length;

export interface StrayThinkCloseCut {
  text: string;
  answerEnded: boolean;
}

export interface StrayThinkCloseFilter {
  push: (chunk: string) => string;
  finish: () => string;
  answerEnded: () => boolean;
}

interface HeldTail {
  headTerms: Set<string>;
  windowWords: number;
}

const SENTENCE_END = /[.!?…。！？।॥۔؟]["'”’»)\]*_`]*$/u;
const WORD = /[\p{L}\p{M}\p{N}]+/gu;
const TAIL_WINDOW_MIN_WORDS = 12;
const TAIL_WINDOW_MAX_WORDS = 48;
const RESTATED_HEAD_TERMS_MIN_PERCENT = 60;
const TAIL_TERMS_FROM_HEAD_MIN_PERCENT = 60;

const endsASentence = (visible: string): boolean =>
  SENTENCE_END.test(visible.trimEnd());

const wordsOf = (text: string): string[] =>
  segmentUnsegmentedScripts(stripThinkMarkers(text).toLowerCase()).match(
    WORD
  ) ?? [];

const termsOf = (text: string): Set<string> =>
  new Set(
    [...extractQueryTerms(text)].map((term) =>
      stemPrefix(foldForMatching(term))
    )
  );

const isAtLeastPercent = (part: number, whole: number, percent: number) =>
  whole > 0 && part * 100 >= whole * percent;

const restatesHead = (headTerms: Set<string>, tailWords: string[]): boolean => {
  const tailTerms = termsOf(tailWords.join(' '));
  const shared = [...tailTerms].filter((term) => headTerms.has(term)).length;
  return (
    shared > 0 &&
    isAtLeastPercent(shared, headTerms.size, RESTATED_HEAD_TERMS_MIN_PERCENT) &&
    isAtLeastPercent(shared, tailTerms.size, TAIL_TERMS_FROM_HEAD_MIN_PERCENT)
  );
};

const tailAfter = (head: string): HeldTail => ({
  headTerms: termsOf(head),
  windowWords: Math.min(
    TAIL_WINDOW_MAX_WORDS,
    Math.max(TAIL_WINDOW_MIN_WORDS, wordsOf(head).length)
  ),
});

const unfinishedTagStart = (text: string): number => {
  const earliest = Math.max(0, text.length - THINK_CLOSE.length + 1);
  for (let start = earliest; start < text.length; start += 1) {
    const rest = text.slice(start);
    if (THINK_CLOSE.startsWith(rest) || THINK_OPEN.startsWith(rest)) {
      return start;
    }
  }
  return text.length;
};

export const createStrayThinkCloseFilter = (): StrayThinkCloseFilter => {
  let pending = '';
  let said = '';
  let open = false;
  let held: HeldTail | null = null;
  let ended = false;

  const take = (length: number): string => {
    const taken = pending.slice(0, length);
    pending = pending.slice(length);
    return taken;
  };

  const sayOutsideThink = (text: string) => {
    if (!open) said += text;
  };

  const drain = (finished: boolean): string => {
    let out = '';
    for (;;) {
      if (held) {
        const words = wordsOf(pending);
        if (!finished && words.length <= held.windowWords) return out;
        ended = restatesHead(held.headTerms, words.slice(0, held.windowWords));
        held = null;
        if (ended) {
          pending = '';
          return out;
        }
      }
      const nextOpen = pending.indexOf(THINK_OPEN);
      const nextClose = pending.indexOf(THINK_CLOSE);
      if (nextOpen === -1 && nextClose === -1) {
        const text = take(
          finished ? pending.length : unfinishedTagStart(pending)
        );
        sayOutsideThink(text);
        return out + text;
      }
      if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
        sayOutsideThink(pending.slice(0, nextOpen));
        out += take(nextOpen + THINK_OPEN.length);
        open = true;
        continue;
      }
      if (open) {
        out += take(nextClose + THINK_CLOSE.length);
        open = false;
        continue;
      }
      const beforeClose = take(nextClose);
      take(THINK_CLOSE.length);
      said += beforeClose;
      out += beforeClose;
      if (endsASentence(said)) held = tailAfter(said);
    }
  };

  return {
    push: (chunk) => {
      if (ended) return '';
      pending += chunk;
      return drain(false);
    },
    finish: () => (ended ? '' : drain(true)),
    answerEnded: () => ended,
  };
};

export const cutAtStrayThinkClose = (text: string): StrayThinkCloseCut => {
  const filter = createStrayThinkCloseFilter();
  const shown = filter.push(text) + filter.finish();
  return { text: shown, answerEnded: filter.answerEnded() };
};

export const stripThinkMarkers = (text: string): string =>
  text.split(THINK_OPEN).join('').split(THINK_CLOSE).join('');

export const parseThinkingContent = (text: string): ThinkingParts => {
  const source = normalizeThinkMarkup(text);
  const thinkStartIndex = source.indexOf(THINK_OPEN);
  if (thinkStartIndex === -1) {
    return { normalContent: source, thinkingContent: null, hasThinking: false };
  }

  const [normalBeforeThink = '', ...afterSegments] =
    outsideThinkSegments(source);
  const thinkEndIndex = source.indexOf(THINK_CLOSE);

  if (thinkEndIndex === -1) {
    return {
      normalContent: normalBeforeThink,
      thinkingContent: source.slice(thinkStartIndex + THINK_OPEN.length),
      hasThinking: true,
      isThinkingComplete: false,
      normalAfterThink: '',
    };
  }

  return {
    normalContent: normalBeforeThink,
    thinkingContent: thinkBlocksText(source),
    hasThinking: true,
    isThinkingComplete: true,
    normalAfterThink: afterSegments.join(''),
  };
};

export const outsideThinkSegments = (text: string): string[] => {
  const source = normalizeThinkMarkup(text);
  const segments: string[] = [];
  let cursor = 0;
  let open = source.indexOf(THINK_OPEN);

  while (open !== -1) {
    segments.push(source.slice(cursor, open));
    const close = source.indexOf(THINK_CLOSE, open + THINK_OPEN.length);
    if (close === -1) return segments;
    cursor = close + THINK_CLOSE.length;
    open = source.indexOf(THINK_OPEN, cursor);
  }

  segments.push(source.slice(cursor));
  return segments;
};

export const stripThinkBlocks = (text: string): string =>
  outsideThinkSegments(text).join('').trim();

export const unclosedThinkText = (text: string): string => {
  const source = normalizeThinkMarkup(text);
  const open = source.lastIndexOf(THINK_OPEN);
  if (open === -1) return '';
  const contentStart = open + THINK_OPEN.length;
  return source.indexOf(THINK_CLOSE, contentStart) === -1
    ? source.slice(contentStart)
    : '';
};

export const unclosedThinkAsAnswer = (text: string): string => {
  const source = normalizeThinkMarkup(text);
  const open = source.lastIndexOf(THINK_OPEN);
  if (open === -1) return text;
  const contentStart = open + THINK_OPEN.length;
  if (source.indexOf(THINK_CLOSE, contentStart) !== -1) return text;
  return `${source.slice(0, open)}${source.slice(contentStart).trimStart()}`;
};

export const mapOutsideThink = (
  text: string,
  transform: (segment: string) => string
): string => {
  const source = normalizeThinkMarkup(text);
  const parts: string[] = [];
  let cursor = 0;
  let open = source.indexOf(THINK_OPEN);

  while (open !== -1) {
    parts.push(transform(source.slice(cursor, open)));
    const close = source.indexOf(THINK_CLOSE, open + THINK_OPEN.length);
    if (close === -1) {
      parts.push(source.slice(open));
      return parts.join('');
    }
    cursor = close + THINK_CLOSE.length;
    parts.push(source.slice(open, cursor));
    open = source.indexOf(THINK_OPEN, cursor);
  }

  parts.push(transform(source.slice(cursor)));
  return parts.join('');
};

export const thinkBlocksText = (text: string): string => {
  const source = normalizeThinkMarkup(text);
  const blocks: string[] = [];
  let open = source.indexOf(THINK_OPEN);

  while (open !== -1) {
    const contentStart = open + THINK_OPEN.length;
    const close = source.indexOf(THINK_CLOSE, contentStart);
    if (close === -1) {
      blocks.push(source.slice(contentStart));
      break;
    }
    blocks.push(source.slice(contentStart, close));
    open = source.indexOf(THINK_OPEN, close + THINK_CLOSE.length);
  }

  return blocks.join('\n\n').trim();
};
