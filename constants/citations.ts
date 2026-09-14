export const CITATION_PATTERN = /(^|[^\w$)\]])\[\d{1,3}\]/g;
const SENTENCE_CHAR_OR_DECIMAL_POINT = '(?:[^.!?\\n]|[.!?](?=\\d))';
const SENTENCE_TERMINATOR = '[.!?]+(?!\\d)';
export const CITATION_SENTENCE_PATTERN = new RegExp(
  `${SENTENCE_CHAR_OR_DECIMAL_POINT}*${SENTENCE_TERMINATOR}|\\n+|${SENTENCE_CHAR_OR_DECIMAL_POINT}+$`,
  'g'
);
export const CITATION_STEM_PREFIX_LENGTH = 5;
export const CITATION_ALPHA_TERM_PATTERN = /^[a-ząćęłńóśźż]+$/;
export const CITATION_MIN_MATCH_SCORE = 2;
export const CITATION_EXCERPT_MAX_CHARS = 300;
export const CITATION_DOCUMENT_NAME_TOKEN_PATTERN = /[^a-z0-9ąćęłńóśźż]+/i;
export const THINK_OPEN = '<think>';
export const THINK_CLOSE = '</think>';

export const NEGATION_CUE_EN =
  /\b(no|not|n['’]t|never|none|neither|nor|without|lacks?|lacking)\b/i;

export const CLAUSE_SPLIT_PATTERN =
  /[,;]|\b(?:but|however|although|though|whereas|while)\b/i;

// Coverage nouns (does a source address the topic); a refusal negates one, a negative-fact answer does not.
const NO_ANSWER_META_EN =
  'information|info|mention|reference|data|details?|indication|records?';
const PL_WORD_CHAR = '[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]';
const PL_NEGATED_PARTICIPLE =
  'określon|podan|wskazan|wymienion|opisan|zawart|dostępn|sprecyzowan|ujęt|udokumentowan';
const PL_COVERAGE_NOUN =
  'kontek|materia|źród|treś|informacj|dokumen|plik|dan(?:e|ych)|tekst|fragment';
const NO_ANSWER_META_PL =
  'informacj\\w*|info|wzmian\\w*|danych|dane|mowy|odniesie\\w*|dokumen\\w*|plik\\w*|tematu|tekst\\w*|materia\\w*|źród\\w*|nic|niczego';

// English "no information" refusal patterns; each negation is tied to a coverage noun.
export const NO_ANSWER_PATTERNS_EN: RegExp[] = [
  new RegExp(`\\bno [^.!?]{0,40}?\\b(${NO_ANSWER_META_EN})\\b`, 'i'),
  new RegExp(
    `\\bthere (is|are|'s) no [^.!?]{0,40}?\\b(${NO_ANSWER_META_EN})\\b`,
    'i'
  ),
  new RegExp(
    `\\b(does|do|did|could|can) ?n['o]?t (contain|mention|include|provide|specify|cover|have|state|say)( any| any relevant)? (${NO_ANSWER_META_EN})\\b`,
    'i'
  ),
  new RegExp(
    `\\b(${NO_ANSWER_META_EN}) (is|are|'s|was|were)?\\s?(not|n['o]?t) (mentioned|found|provided|specified|stated|included|present|available|given)\\b`,
    'i'
  ),
  /\bnot (found|available|mentioned|provided|present|specified|stated) in (the|these|any|this|your|provided|given)\b/i,
  /\bi (do ?n['o]?t|cannot|can ?not|can['o]?t) (know|find|see|answer|tell|determine|locate)\b/i,
  /\bunable to (find|answer|determine|locate|provide)\b/i,
];

// Polish "brak informacji" refusal patterns; each negation is tied to a coverage noun.
export const NO_ANSWER_PATTERNS_PL: RegExp[] = [
  new RegExp(
    `\\b(nie ma|brak|nie zawiera${PL_WORD_CHAR}*|nie znaleziono|nie podano|nie wymienia${PL_WORD_CHAR}*|nie dostarcza${PL_WORD_CHAR}*|nie oferuje${PL_WORD_CHAR}*) [^.!?]{0,40}?\\b(${NO_ANSWER_META_PL})\\b`,
    'i'
  ),
  /\bnie wspomina\w*\b/i,
  /\bnie odnosi si\w*\b/i,
  /\bnie wiem\b/i,
  /\bnie mog\w* (znaleźć|odpowiedzieć|okre\w*)\b/i,
  new RegExp(
    `\\bnie (jest|są|zosta${PL_WORD_CHAR}+)\\s+(${PL_NEGATED_PARTICIPLE})${PL_WORD_CHAR}*[^.!?]*\\b(${PL_COVERAGE_NOUN})`,
    'i'
  ),
  new RegExp(
    `\\b(${PL_COVERAGE_NOUN})${PL_WORD_CHAR}*[^.!?]*\\bnie (jest|są|zosta${PL_WORD_CHAR}+)\\s+(${PL_NEGATED_PARTICIPLE})`,
    'i'
  ),
];
