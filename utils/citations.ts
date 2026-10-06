import { CITATION_PATTERN } from '../constants/citations';

const REMOVED_MARKER = '\uE000';
const MARKER_BEFORE_PUNCTUATION = /[ \t]*\uE000+[ \t]*(?=[.,;:!?])/g;
const MARKER_BETWEEN_WORDS = /([ \t]*)\uE000+([ \t]*)/g;

export const stripCitations = (text: string): string => {
  if (!text) return text;

  let stripped = text;
  let previous: string;
  do {
    previous = stripped;
    stripped = stripped.replace(CITATION_PATTERN, `$1${REMOVED_MARKER}`);
  } while (stripped !== previous);

  return stripped
    .replace(MARKER_BEFORE_PUNCTUATION, '')
    .replace(
      MARKER_BETWEEN_WORDS,
      (
        match: string,
        before: string,
        after: string,
        offset: number,
        whole: string
      ) => {
        const startsLine = offset === 0 || whole[offset - 1] === '\n';
        const endsLine =
          offset + match.length === whole.length ||
          whole[offset + match.length] === '\n';
        if (endsLine) return '';
        if (startsLine) return before;
        return before || after ? ' ' : '';
      }
    );
};
