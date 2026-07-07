import { CITATION_PATTERN } from '../constants/citations';

export const stripCitations = (text: string): string => {
  if (!text) return text;

  let stripped = text;
  let previous: string;
  do {
    previous = stripped;
    stripped = stripped.replace(CITATION_PATTERN, '$1');
  } while (stripped !== previous);

  return stripped
    .replace(/ +([.,;:!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ');
};
