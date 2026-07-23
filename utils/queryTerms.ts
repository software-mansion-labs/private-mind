// Query tokenization shared by hybrid retrieval and citation highlighting so
// both tokenize the prompt the same way.

// Deliberately narrow per-language stopword lists (function words only, not a
// full corpus): they keep question words from becoming content terms during
// coverage scoring / highlighting. FTS keyword search leaves this to BM25's IDF.
const EN_STOPWORDS = [
  'the',
  'and',
  'for',
  'are',
  'was',
  'were',
  'this',
  'that',
  'with',
  'from',
  'what',
  'which',
  'who',
  'whom',
  'how',
  'why',
  'when',
  'where',
  'does',
  'did',
  'has',
  'have',
  'had',
  'you',
  'your',
  'about',
  'into',
  'their',
  'they',
  'them',
  'can',
  'could',
  'would',
  'should',
  'will',
  'shall',
  'not',
  'but',
  'all',
  'any',
];

const PL_STOPWORDS = [
  'jak',
  'jest',
  'czy',
  'oraz',
  'lub',
  'albo',
  'dla',
  'nie',
  'tak',
  'sie',
  'się',
  'jego',
  'jej',
  'tego',
  'tej',
  'ten',
  'tym',
  'moze',
  'może',
  'jakie',
  'jaki',
  'jaka',
  'gdzie',
  'kiedy',
  'dlaczego',
  'kto',
  'kogo',
  'ktore',
  'które',
  'ich',
  'przez',
  'przy',
  'aby',
  'zeby',
  'żeby',
];

const STOPWORDS = new Set([...EN_STOPWORDS, ...PL_STOPWORDS]);

// Non-ASCII letters the tokenizer recognises — Polish only today. To add a
// language, extend this and add its stopword group above.
const PL_LETTERS = 'ąćęłńóśźż';

// Drop tokens shorter than this so bare numbers/short codes ("5", "L4") can't
// match unrelated passages; real identifiers ("219039") are longer.
const MIN_TERM_LENGTH = 3;

export const TOKEN_PATTERN = new RegExp(`[a-z0-9${PL_LETTERS}]+`, 'gi');

export const extractQueryTerms = (query: string): Set<string> => {
  const terms = new Set<string>();
  const matches = query.toLowerCase().match(TOKEN_PATTERN);
  if (!matches) return terms;

  for (const token of matches) {
    if (token.length >= MIN_TERM_LENGTH && !STOPWORDS.has(token)) {
      terms.add(token);
    }
  }

  return terms;
};

const STEM_MIN_TERM_LENGTH = 5;
const WORD_PATTERN = new RegExp(`^[a-z${PL_LETTERS}]+$`, 'i');

export const stemPrefix = (term: string): string =>
  WORD_PATTERN.test(term) && term.length >= STEM_MIN_TERM_LENGTH
    ? term.slice(0, Math.max(4, term.length - 2))
    : term;

const FOLD_MAP: Record<string, string> = {
  ą: 'a',
  ć: 'c',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
};

export const foldForMatching = (text: string): string =>
  text.toLowerCase().replace(/[ąćęłńóśźż]/g, (char) => FOLD_MAP[char] ?? char);
