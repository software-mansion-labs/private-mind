// Query tokenization shared by hybrid retrieval and citation highlighting so
// both tokenize the prompt the same way.

// Narrow per-language stopword lists (function words only): keep question words
// from becoming content terms in coverage scoring / highlighting.
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
  'much',
  'many',
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

// Function words only, same rule as the lists above.
const HI_STOPWORDS = [
  'क्या',
  'कैसे',
  'कैसा',
  'कैसी',
  'कहाँ',
  'कहां',
  'क्यों',
  'कौन',
  'कितना',
  'कितनी',
  'कितने',
  'है',
  'हैं',
  'था',
  'थी',
  'थे',
  'होगा',
  'होगी',
  'का',
  'की',
  'के',
  'को',
  'में',
  'से',
  'पर',
  'और',
  'या',
  'यह',
  'वह',
  'ये',
  'वे',
  'नहीं',
  'लिए',
  'साथ',
  'तक',
  'भी',
  'कर',
  'हो',
];

const UR_STOPWORDS = [
  'کیا',
  'کیسے',
  'کیسا',
  'کیسی',
  'کہاں',
  'کیوں',
  'کون',
  'کتنا',
  'کتنی',
  'ہے',
  'ہیں',
  'تھا',
  'تھی',
  'تھے',
  'کا',
  'کی',
  'کے',
  'کو',
  'میں',
  'سے',
  'پر',
  'اور',
  'یا',
  'یہ',
  'وہ',
  'نہیں',
  'لیے',
  'ساتھ',
  'تک',
  'بھی',
  'کر',
];

const DE_STOPWORDS = [
  'der',
  'die',
  'das',
  'und',
  'ist',
  'sind',
  'war',
  'waren',
  'wie',
  'was',
  'wer',
  'wann',
  'warum',
  'welche',
  'welcher',
  'welches',
  'für',
  'mit',
  'von',
  'aus',
  'auf',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'einer',
  'nicht',
  'auch',
  'aber',
  'oder',
  'wird',
  'werden',
  'hat',
  'haben',
  'kann',
  'können',
  'soll',
  'muss',
  'müssen',
  'sich',
  'als',
  'bei',
  'nach',
  'über',
  'unter',
  'vor',
  'zum',
  'zur',
  'beim',
];

const PT_STOPWORDS = [
  'que',
  'qual',
  'quais',
  'como',
  'quando',
  'onde',
  'por',
  'para',
  'com',
  'sem',
  'dos',
  'das',
  'uma',
  'umas',
  'uns',
  'são',
  'está',
  'estão',
  'ser',
  'estar',
  'tem',
  'têm',
  'ter',
  'mais',
  'menos',
  'muito',
  'pelo',
  'pela',
  'nos',
  'nas',
  'isso',
  'isto',
  'esse',
  'essa',
  'este',
  'esta',
  'aos',
  'ainda',
  'também',
  'sobre',
  'entre',
  'desde',
  'não',
];

const ES_STOPWORDS = [
  'que',
  'qué',
  'cual',
  'cuál',
  'cuales',
  'como',
  'cómo',
  'cuando',
  'cuándo',
  'donde',
  'dónde',
  'por',
  'para',
  'con',
  'sin',
  'los',
  'las',
  'una',
  'unos',
  'unas',
  'son',
  'está',
  'están',
  'ser',
  'estar',
  'tiene',
  'tienen',
  'tener',
  'más',
  'menos',
  'muy',
  'del',
  'este',
  'esta',
  'esto',
  'ese',
  'esa',
  'eso',
  'sobre',
  'entre',
  'desde',
  'hay',
  'pero',
  'también',
];

const FR_STOPWORDS = [
  'que',
  'quel',
  'quelle',
  'quels',
  'quelles',
  'comment',
  'quand',
  'pour',
  'avec',
  'sans',
  'les',
  'des',
  'une',
  'est',
  'sont',
  'était',
  'étaient',
  'être',
  'avoir',
  'plus',
  'moins',
  'très',
  'dans',
  'sur',
  'par',
  'aux',
  'cette',
  'cet',
  'ces',
  'mais',
  'aussi',
  'entre',
  'depuis',
  'fait',
  'faire',
  'peut',
  'pouvoir',
  'tout',
  'tous',
  'pas',
];

const RU_STOPWORDS = [
  'как',
  'что',
  'где',
  'когда',
  'почему',
  'какой',
  'какая',
  'какое',
  'какие',
  'для',
  'это',
  'этот',
  'эта',
  'эти',
  'был',
  'была',
  'были',
  'быть',
  'есть',
  'нет',
  'или',
  'также',
  'более',
  'менее',
  'очень',
  'при',
  'над',
  'под',
  'про',
  'его',
  'их',
  'они',
  'она',
  'оно',
];

const AR_STOPWORDS = [
  'هذا',
  'هذه',
  'ذلك',
  'التي',
  'الذي',
  'كيف',
  'متى',
  'أين',
  'لماذا',
  'كان',
  'كانت',
  'يكون',
  'مع',
  'بين',
  'بعد',
  'قبل',
  'كل',
  'بعض',
  'حال',
  'على',
  'عن',
  'إلى',
  'من',
  'في',
];

const FA_STOPWORDS = [
  'چه',
  'چگونه',
  'چطور',
  'کجا',
  'چرا',
  'کدام',
  'چند',
  'است',
  'هست',
  'بود',
  'بودند',
  'باشد',
  'این',
  'آن',
  'که',
  'را',
  'از',
  'به',
  'در',
  'با',
  'برای',
  'های',
  'هم',
  'یا',
  'تا',
  'نیست',
];

const ID_STOPWORDS = [
  'yang',
  'ini',
  'itu',
  'dan',
  'atau',
  'dengan',
  'untuk',
  'dari',
  'pada',
  'adalah',
  'ada',
  'akan',
  'sudah',
  'telah',
  'bisa',
  'dapat',
  'bagaimana',
  'apa',
  'siapa',
  'kapan',
  'mengapa',
  'berapa',
  'oleh',
  'juga',
  'tidak',
  'saya',
  'anda',
  'cara',
];

const TR_STOPWORDS = [
  'nasıl',
  'nedir',
  'nerede',
  'neden',
  'niçin',
  'hangi',
  'kaç',
  'kadar',
  'için',
  'ile',
  'bir',
  'bu',
  'şu',
  've',
  'veya',
  'ama',
  'fakat',
  'olan',
  'olarak',
  'var',
  'yok',
  'değil',
  'daha',
  'çok',
];

const IT_STOPWORDS = [
  'che',
  'quale',
  'quali',
  'come',
  'quando',
  'dove',
  'per',
  'con',
  'senza',
  'del',
  'della',
  'dei',
  'delle',
  'una',
  'uno',
  'sono',
  'essere',
  'avere',
  'più',
  'meno',
  'molto',
  'questo',
  'questa',
  'questi',
  'queste',
  'sul',
  'sulla',
  'nel',
  'nella',
  'anche',
  'tra',
  'fra',
  'dal',
  'dalla',
  'alla',
  'allo',
  'gli',
  'non',
  'oppure',
];

const STOPWORDS = new Set([
  ...EN_STOPWORDS,
  ...PL_STOPWORDS,
  ...HI_STOPWORDS,
  ...UR_STOPWORDS,
  ...DE_STOPWORDS,
  ...PT_STOPWORDS,
  ...ES_STOPWORDS,
  ...FR_STOPWORDS,
  ...RU_STOPWORDS,
  ...AR_STOPWORDS,
  ...FA_STOPWORDS,
  ...ID_STOPWORDS,
  ...TR_STOPWORDS,
  ...IT_STOPWORDS,
]);

// Explicit ranges rather than \p{L}: unicode property escapes are not
// guaranteed on every engine this ships to.
const LETTER_RANGES = [
  'a-z',
  '\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u024f', // Latin-1 + Extended A/B (× ÷ excluded)
  // Turkish "İ" lowercases to "i"+U+0307; keep this mark range so the token
  // doesn't split there (`foldForMatching` strips the marks later).
  '\\u0300-\\u036f',
  '\\u0370-\\u03ff', // Greek
  '\\u0400-\\u04ff', // Cyrillic
  '\\u0590-\\u05ff', // Hebrew
  '\\u0600-\\u06ff', // Arabic
  '\\u0900-\\u097f', // Devanagari
  '\\u0e00-\\u0e7f', // Thai
  '\\u3040-\\u30ff', // Hiragana + Katakana
  '\\u3400-\\u4dbf\\u4e00-\\u9fff', // CJK ideographs
  '\\uac00-\\ud7af', // Hangul syllables (precomposed; bare jamo combine, so they are left out)
].join('');

// Drop tokens shorter than this so bare numbers/short codes ("5", "L4") can't
// match unrelated passages; real identifiers ("219039") are longer.
const MIN_TERM_LENGTH = 3;

// Devanagari/Arabic content words can be 2 chars (जल, گل, آج); keep them past
// the 3-char floor.
const SHORT_WORD_SCRIPT = /[\p{Script=Arabic}\p{Script=Devanagari}]/u;
const isLongEnough = (token: string): boolean =>
  token.length >= MIN_TERM_LENGTH ||
  (token.length === 2 && SHORT_WORD_SCRIPT.test(token));

// Written without spaces, so a whole clause arrives as one token: index
// overlapping character bigrams instead.
const UNSEGMENTED_RANGES =
  '\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\u0e00-\\u0e7f';
const UNSEGMENTED_PATTERN = new RegExp(`[${UNSEGMENTED_RANGES}]`);
// CJK glues names/dates onto following chars ("iPhone15の新機能"); split runs so
// only the CJK part is bigrammed, not the Latin.
const SCRIPT_RUN_PATTERN = new RegExp(
  `[${UNSEGMENTED_RANGES}]+|[^${UNSEGMENTED_RANGES}]+`,
  'g'
);
const GRAM_LENGTH = 2;

// Combining marks are intentional here — they are part of the words matched.
// eslint-disable-next-line no-misleading-character-class
export const TOKEN_PATTERN = new RegExp(`[0-9${LETTER_RANGES}]+`, 'gi');

const characterGrams = (token: string): string[] => {
  if (token.length <= GRAM_LENGTH) return [token];
  const grams: string[] = [];
  for (let i = 0; i + GRAM_LENGTH <= token.length; i += 1) {
    grams.push(token.slice(i, i + GRAM_LENGTH));
  }
  return grams;
};

export const extractQueryTerms = (query: string): Set<string> => {
  const terms = new Set<string>();
  const matches = query.toLowerCase().match(TOKEN_PATTERN);
  if (!matches) return terms;

  for (const token of matches) {
    if (STOPWORDS.has(token)) continue;
    for (const run of token.match(SCRIPT_RUN_PATTERN) ?? []) {
      if (STOPWORDS.has(run)) continue;
      if (UNSEGMENTED_PATTERN.test(run)) {
        // A lone ideograph left over from the split is a character, not a word.
        if (run.length < GRAM_LENGTH) continue;
        for (const gram of characterGrams(run)) terms.add(gram);
      } else if (isLongEnough(run)) {
        terms.add(run);
      }
    }
  }

  return terms;
};

const STEM_MIN_TERM_LENGTH = 5;
// Alphabetic scripts only — a CJK bigram must never be suffix-stripped.
const WORD_PATTERN = new RegExp(
  '^[a-z\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u024f\\u0370-\\u03ff\\u0400-\\u04ff]+$',
  'i'
);

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

// Stroke and ligature letters have no combining-mark decomposition, so NFD
// leaves them untouched — they have to be spelled out.
const UNDECOMPOSABLE: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ð: 'd',
  þ: 'th',
  ł: 'l',
  đ: 'd',
  ø: 'o',
  ħ: 'h',
  ŧ: 't',
};

const UNDECOMPOSABLE_PATTERN = new RegExp(
  `[${Object.keys(UNDECOMPOSABLE).join('')}]`,
  'g'
);

const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

const canNormalize = typeof String.prototype.normalize === 'function';

export const foldForMatching = (text: string): string => {
  const lower = text
    .toLowerCase()
    .replace(UNDECOMPOSABLE_PATTERN, (char) => UNDECOMPOSABLE[char] ?? char);
  return canNormalize
    ? lower.normalize('NFD').replace(COMBINING_MARKS, '')
    : lower.replace(/[ąćęńóśźż]/g, (char) => FOLD_MAP[char] ?? char);
};
