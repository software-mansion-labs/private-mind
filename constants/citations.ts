export const CITATION_PATTERN = /(^|[^\w$)\]])\[\d{1,3}\]/g;
export const CITATION_SENTENCE_PATTERN = /[^.!?\n]*[.!?]+|\n+|[^.!?\n]+$/g;
export const CITATION_STEM_PREFIX_LENGTH = 5;
export const CITATION_ALPHA_TERM_PATTERN = /^[a-ząćęłńóśźż]+$/;
export const CITATION_MIN_MATCH_SCORE = 2;
export const CITATION_EXCERPT_MAX_CHARS = 300;
export const CITATION_DOCUMENT_NAME_TOKEN_PATTERN = /[^a-z0-9ąćęłńóśźż]+/i;
