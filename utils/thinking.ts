import { THINK_CLOSE, THINK_OPEN } from '../constants/citations';

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
