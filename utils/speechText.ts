import { MAX_SPOKEN_CHARACTERS } from '../constants/read-aloud';
import { stripCitations } from './citations';
import { stripSpecialTokens } from './specialTokens';
import { stripThinkBlocks } from './thinking';

const FENCED_CODE_BLOCK =
  /(^|\n)[ \t]*(```|~~~)[\s\S]*?(?:\n[ \t]*\2[^\n]*|$)/g;
const TABLE_ROW = /^[ \t]*\|.*$/gm;
const TABLE_RULE =
  /^[ \t]*:?-{2,}:?(?:[ \t]*\|[ \t]*:?-{2,}:?)+[ \t]*\|?[ \t]*$/gm;
const HTML_TAG = /<\/?[a-zA-Z][^>\n]*>/g;
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const INLINE_LINK = /\[([^\]]+)\]\([^)]*\)/g;
const REFERENCE_LINK = /\[([^\]]+)\]\[[^\]]*\]/g;
const LINK_DEFINITION = /^[ \t]*\[[^\]]+\]:[ \t]*\S+.*$/gm;
const BARE_URL = /(?:https?:\/\/|www\.)[^\s<>)\]]+/gi;
const BARE_EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const BRACKETED_NUMBER = /\s?\[\d{1,3}\]/g;
const HEADING_MARKER = /^[ \t]{0,3}#{1,6}[ \t]+/gm;
const BLOCKQUOTE_MARKER = /^[ \t]*(?:>[ \t]?)+/gm;
const LIST_MARKER = /^[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]+/gm;
const TASK_BOX = /^\[[ xX]\][ \t]+/gm;
const HORIZONTAL_RULE = /^[ \t]*(?:[-*_][ \t]*){3,}$/gm;
const EMPHASIS = /(^|[^\w])(\*{1,3}|_{1,3}|~~)(?=\S)([^\n]*?\S)\2(?!\w)/g;
const STRAY_EMPHASIS = /\*{2,3}|~~/g;
const INLINE_CODE = /`([^`\n]*)`/g;
const STRAY_BACKTICKS = /`+/g;
const ESCAPED_PUNCTUATION = /\\([\\`*_{}[\]()#+\-.!|>~])/g;
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{25A0}-\u{27BF}\u{2B00}-\u{2BFF}\u{E0020}-\u{E007F}]|\u{FE0E}|\u{FE0F}|\u{200D}|\u{20E3}/gu;
const LINE_ENDS_WITH_PUNCTUATION = /[.!?…:;,)"'»”]$/;
const SENTENCE_END = /[.!?…]["'»”)]*\s/g;

const closeLine = (line: string): string => {
  const trimmed = line.trim();
  if (!trimmed || LINE_ENDS_WITH_PUNCTUATION.test(trimmed)) return trimmed;
  return `${trimmed}.`;
};

const withoutEmphasis = (text: string): string => {
  let previous: string;
  let current = text;
  do {
    previous = current;
    current = current.replace(EMPHASIS, '$1$3');
  } while (current !== previous);
  return current.replace(STRAY_EMPHASIS, '');
};

export const cutAtSentence = (text: string, limit: number): string => {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit);
  let lastEnd = -1;
  for (const match of `${head} `.matchAll(SENTENCE_END)) {
    lastEnd = (match.index ?? 0) + match[0].trimEnd().length;
  }
  return (lastEnd > 0 ? head.slice(0, lastEnd) : head).trim();
};

export const cleanForSpeech = (
  text: string,
  limit: number = MAX_SPOKEN_CHARACTERS
): string => {
  if (!text) return '';

  const plain = stripCitations(stripSpecialTokens(stripThinkBlocks(text)))
    .replace(FENCED_CODE_BLOCK, '$1')
    .replace(TABLE_RULE, '')
    .replace(TABLE_ROW, '')
    .replace(LINK_DEFINITION, '')
    .replace(IMAGE, '')
    .replace(INLINE_LINK, '$1')
    .replace(REFERENCE_LINK, '$1')
    .replace(HTML_TAG, '')
    .replace(BARE_URL, '')
    .replace(BARE_EMAIL, '')
    .replace(BRACKETED_NUMBER, '')
    .replace(HORIZONTAL_RULE, '')
    .replace(HEADING_MARKER, '')
    .replace(BLOCKQUOTE_MARKER, '')
    .replace(LIST_MARKER, '')
    .replace(TASK_BOX, '')
    .replace(INLINE_CODE, '$1')
    .replace(STRAY_BACKTICKS, '');

  const spoken = withoutEmphasis(plain)
    .replace(ESCAPED_PUNCTUATION, '$1')
    .replace(EMOJI, ' ')
    .split('\n')
    .map(closeLine)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return cutAtSentence(spoken, limit);
};
