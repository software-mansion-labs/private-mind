const SQUARE_BRACKET_NOTE = /\[[^\]]*\]/g;
const LOWERCASE_PARENTHESIS_NOTE = /\((?:[a-z][a-z' -]*)\)/g;
const SPACE_BEFORE_PUNCTUATION = /\s+([,.!?;:])/g;
const RUNS_OF_SPACE = /\s{2,}/g;

export const withoutNonSpeechNotes = (transcript: string): string =>
  transcript
    .replace(SQUARE_BRACKET_NOTE, ' ')
    .replace(LOWERCASE_PARENTHESIS_NOTE, ' ')
    .replace(RUNS_OF_SPACE, ' ')
    .replace(SPACE_BEFORE_PUNCTUATION, '$1')
    .trim();
