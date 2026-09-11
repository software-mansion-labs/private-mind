export interface QuestionLanguage {
  code: string;
  name: string;
  script?: string;
}

const NAMES: Record<string, string> = {
  pl: 'Polish',
  en: 'English',
  de: 'German',
  nl: 'Dutch',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  ro: 'Romanian',
  cs: 'Czech',
  tr: 'Turkish',
  id: 'Indonesian',
  vi: 'Vietnamese',
  ru: 'Russian',
  uk: 'Ukrainian',
  hi: 'Hindi',
  bn: 'Bengali',
  ur: 'Urdu',
  ar: 'Arabic',
  fa: 'Persian',
  he: 'Hebrew',
  el: 'Greek',
  th: 'Thai',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
};

const SCRIPTS: Record<string, string> = {
  ru: 'Cyrillic script',
  uk: 'Cyrillic script',
  hi: 'Devanagari script',
  bn: 'Bengali script',
  ur: 'Arabic script',
  ar: 'Arabic script',
  fa: 'Arabic script',
  he: 'Hebrew script',
  el: 'Greek script',
  th: 'Thai script',
  zh: 'Chinese characters',
  ja: 'Japanese script',
  ko: 'Hangul',
};

const KANA = /[ぁ-ヺ]/;
const HAN = /[一-鿿]/;
const HANGUL = /[가-힣]/;
const DEVANAGARI = /[ऀ-ॿ]/;
const BENGALI = /[ঀ-৿]/;
const THAI = /[฀-๿]/;
const GREEK = /[ͰͲ-Ͽ]|[α-ωΑ-Ω]/;
const HEBREW = /[֐-׿]/;
const ARABIC_SCRIPT = /[؀-ۿ]/;
const CYRILLIC = /[Ѐ-ӿ]/;

const SCRIPT_GROUPS: [RegExp, string[]][] = [
  [HANGUL, ['ko']],
  [DEVANAGARI, ['hi']],
  [BENGALI, ['bn']],
  [THAI, ['th']],
  [HEBREW, ['he']],
  [GREEK, ['el']],
  [HAN, ['zh']],
  [ARABIC_SCRIPT, ['ar', 'fa', 'ur']],
  [CYRILLIC, ['ru', 'uk']],
];

const MIN_SCRIPT_CHARS = 2;

const LATIN_CANDIDATES = [
  'en',
  'pl',
  'cs',
  'de',
  'nl',
  'fr',
  'es',
  'pt',
  'it',
  'ro',
  'tr',
  'id',
  'vi',
];

const LETTERS: Record<string, string> = {
  pl: 'ąęłżźśćń',
  cs: 'ěřůňďť',
  de: 'äöüß',
  tr: 'ığşçöü',
  fr: 'œùêîôâëïèàçé',
  it: 'èàòìùé',
  es: 'ñ¿¡áéíóú',
  pt: 'ãõçàêóáéíú',
  ro: 'ăîâșț',
  vi: 'ơưđạệếốộằ',
  nl: 'ĳ',
  ru: 'ыэъё',
  uk: 'іїєґ',
  ur: 'ٹڈڑںھےہپچژگ',
  fa: 'پچژگ',
};

const WORDS: Record<string, string> = {
  en: 'who what which is are the how where when why today tomorrow now will latest current news weather price cost of and in for to my me it can do does much many time year best near open per',
  pl: 'kto kim komu kogo co czego czemu jest są czy jak jaka jaki jakie gdzie kiedy ile dlaczego jutro dzisiaj dziś teraz aktualny obecny aktualna najnowsze wiadomości pogoda cena kurs koszt się masz hej cześć siema oraz dla mnie moje jak długo ile kosztuje na od do po za nie to który która które był była było byli były dokonał dokonała znajdź szukaj pokaż sprawdź podaj napisz wyjaśnij kup kupić zrobić działa najlepszy najlepsza najlepsze najtańszy najtańsza najdroższy najdroższa najdroższe największy największa najszybszy najnowszy sklep sklepie polsce polski wynosi',
  cs: 'kdo co je jsou jak kde kdy proč dnes zítra teď zprávy počasí cena kolik stojí jaký jaká jaké nejnovější aktuální mi moje na od do po za to',
  de: 'wer was ist sind wie wo wann warum heute morgen jetzt aktuelle aktueller aktuelles nachrichten wetter preis kosten kostet der die das und für ich mein wieviel viel beantrage bekomme gibt pro',
  nl: 'wie wat welke is zijn hoe waar wanneer waarom vandaag morgen nu actuele nieuws weer prijs kosten kost het de een en voor ik mijn hoeveel krijg aanvragen per',
  fr: 'qui que quoi quel quelle est sont comment quand pourquoi aujourd hui demain maintenant actualités météo prix coût combien le les des du pour mon ma je faire montant',
  es: 'quién quien qué cuál cual es son cómo como dónde donde cuándo cuando hoy mañana ahora noticias tiempo precio cuánto cuanto el los las del para mi yo hacer sacar',
  it: 'chi che cosa quale è sono come dove quando perché oggi domani adesso notizie meteo prezzo quanto costa il gli della per mio io prossima campionato richiedere',
  pt: 'quem que qual é são como onde quando por hoje amanhã agora notícias tempo preço quanto custa custo os das para meu eu fazer tirar próximo salário mínimo imposto do da dos em no na uma tem',
  ro: 'cine ce care este sunt cum unde când de ce astăzi azi mâine acum știri vreme preț cât costă pentru meu eu face cum se obține',
  tr: 'kim ne hangi nedir nasıl nerede ne zaman neden bugün yarın şimdi haberler hava durumu fiyat kaç kadar için benim ben nasıl alınır kuru ücreti',
  id: 'siapa apa yang mana adalah bagaimana dimana kapan mengapa kenapa hari ini besok sekarang berita cuaca harga berapa untuk saya cara membuat mendapatkan terbaru',
  vi: 'nào thế đâu khi tại sao hôm nay bây giờ tin tức thời tiết bao nhiêu tôi làm mới nhất không được',
  ru: 'кто что какой какая какое где когда почему сегодня завтра сейчас как новости погода цена сколько стоит для мне мой самый последние получить сделать составляет около это на по так его она',
  uk: 'хто що який яка яке де коли чому сьогодні завтра зараз як новини погода ціна скільки коштує для мені мій найновіші отримати зробити',
  ar: 'من ما هو هي كيف أين متى لماذا اليوم غدا الآن أخبار الطقس سعر كم كيفية أفضل هل في على هذا هذه التي الذي عن مع كان ليس يوجد حوالي',
  fa: 'کیست چیست چطور چگونه کجا چرا امروز فردا اکنون الان اخبار هوا قیمت چند بهترین آیا است در از به این که را با برای هست نیست حدود دارد',
  ur: 'کون کیا ہے ہیں کیسے کہاں کب کیوں آج کل ابھی خبریں موسم قیمت کتنی کتنا بہترین کے کی کا میں اور سے پر نہیں ہوتا تقریبا',
};

const MARKS = /[̀-ͯ]/g;
const SPECIAL_FOLDS: Record<string, string> = {
  ł: 'l',
  ı: 'i',
  đ: 'd',
  ø: 'o',
  ß: 'ss',
  ħ: 'h',
  ی: 'ي',
  ى: 'ي',
  ک: 'ك',
  أ: 'ا',
  إ: 'ا',
  آ: 'ا',
  ة: 'ه',
};

const FOLDABLE = /[łıđøßħیىکأإآة]/g;

const fold = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(MARKS, '')
    .replace(FOLDABLE, (char) => SPECIAL_FOLDS[char] ?? char);

const index = (source: Record<string, string>, split: 'words' | 'chars') => {
  const map = new Map<string, Set<string>>();
  for (const [code, value] of Object.entries(source)) {
    const units =
      split === 'words'
        ? fold(value)
            .split(/\s+/)
            .filter((word) => word.length >= 2)
        : [...value.toLowerCase()];
    for (const unit of units) {
      const langs = map.get(unit) ?? new Set<string>();
      langs.add(code);
      map.set(unit, langs);
    }
  }
  return map;
};

const WORD_INDEX = index(WORDS, 'words');
const LETTER_INDEX = index(LETTERS, 'chars');

const EXCLUSIVE_WEIGHT = 3;

const pickCandidate = (
  question: string,
  candidates: string[]
): string | null => {
  if (candidates.length === 1) return candidates[0]!;
  const allowed = new Set(candidates);
  const score = new Map<string, number>();
  const exclusive = new Map<string, number>();

  const decisive = (token: string): boolean =>
    token.length >= 3 || !/^[a-z]+$/.test(token);

  const credit = (langs: Set<string> | undefined, isDecisive: boolean) => {
    if (!langs) return;
    const hits = [...langs].filter((code) => allowed.has(code));
    if (hits.length === 0) return;
    const weight = hits.length === 1 ? EXCLUSIVE_WEIGHT : 1;
    for (const code of hits) {
      score.set(code, (score.get(code) ?? 0) + weight);
      if (hits.length === 1 && isDecisive) {
        exclusive.set(code, (exclusive.get(code) ?? 0) + 1);
      }
    }
  };

  for (const token of fold(question).split(/[^\p{L}]+/u)) {
    if (token.length >= 2) credit(WORD_INDEX.get(token), decisive(token));
  }
  for (const char of new Set(question.toLowerCase())) {
    credit(LETTER_INDEX.get(char), true);
  }

  let best: string | null = null;
  let bestScore = 0;
  let runnerUp = 0;
  for (const [code, value] of score) {
    if (value > bestScore) {
      runnerUp = bestScore;
      best = code;
      bestScore = value;
    } else if (value > runnerUp) {
      runnerUp = value;
    }
  }
  if (!best) return null;
  if (bestScore === runnerUp) {
    const tiedWithDecisive = [...score.entries()]
      .filter(([, value]) => value === bestScore)
      .filter(([code]) => (exclusive.get(code) ?? 0) > 0);
    return tiedWithDecisive.length === 1 ? tiedWithDecisive[0]![0] : null;
  }
  if (exclusive.get(best)) return best;
  return bestScore >= EXCLUSIVE_WEIGHT && bestScore - runnerUp >= 2
    ? best
    : null;
};

const named = (code: string): QuestionLanguage => ({
  code,
  name: NAMES[code]!,
  ...(SCRIPTS[code] ? { script: SCRIPTS[code] } : {}),
});

const dominantScript = (question: string): string[] | null => {
  if (KANA.test(question)) return ['ja'];
  let best: string[] | null = null;
  let bestCount = MIN_SCRIPT_CHARS - 1;
  for (const [pattern, candidates] of SCRIPT_GROUPS) {
    let count = 0;
    for (const char of question) if (pattern.test(char)) count += 1;
    if (count > bestCount) {
      best = candidates;
      bestCount = count;
    }
  }
  return best;
};

export const detectQuestionLanguage = (
  question: string
): QuestionLanguage | null => {
  if (!question.trim()) return null;
  const candidates = dominantScript(question);
  if (candidates) {
    const code = pickCandidate(question, candidates);
    if (!code) return candidates.includes('ar') ? named('ar') : null;
    return named(code);
  }
  const latin = pickCandidate(question, LATIN_CANDIDATES);
  return latin ? named(latin) : null;
};

export const detectThreadLanguage = (
  userMessages: string[]
): QuestionLanguage | null => {
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const detected = detectQuestionLanguage(userMessages[i] ?? '');
    if (detected) return detected;
  }
  return null;
};
