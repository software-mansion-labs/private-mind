export type TextScript =
  | 'latin'
  | 'cyrillic'
  | 'greek'
  | 'hebrew'
  | 'arabic'
  | 'devanagari'
  | 'thai'
  | 'cjk';

const SCRIPT_RANGES: { script: TextScript; pattern: RegExp }[] = [
  { script: 'latin', pattern: /[A-Za-zÀ-ɏ]/ },
  { script: 'cyrillic', pattern: /[Ѐ-ӿ]/ },
  { script: 'greek', pattern: /[Ͱ-Ͽ]/ },
  { script: 'hebrew', pattern: /[֐-׿]/ },
  { script: 'arabic', pattern: /[؀-ۿݐ-ݿ]/ },
  { script: 'devanagari', pattern: /[ऀ-ॿ]/ },
  { script: 'thai', pattern: /[฀-๿]/ },
  { script: 'cjk', pattern: /[぀-ヿ㐀-䶿一-鿿가-힯]/ },
];

const MIN_LETTERS_FOR_SCRIPT = 4;
const DOMINANCE_RATIO = 0.5;

export const dominantScript = (text: string): TextScript | null => {
  const counts = new Map<TextScript, number>();
  let total = 0;
  for (const char of text) {
    for (const { script, pattern } of SCRIPT_RANGES) {
      if (pattern.test(char)) {
        counts.set(script, (counts.get(script) ?? 0) + 1);
        total += 1;
        break;
      }
    }
  }
  if (total < MIN_LETTERS_FOR_SCRIPT) return null;
  for (const [script, count] of counts) {
    if (count / total >= DOMINANCE_RATIO) return script;
  }
  return null;
};

export const isForeignScript = (text: string, question: string): boolean => {
  const asked = dominantScript(question);
  if (!asked) return false;
  const found = dominantScript(text);
  return found !== null && found !== asked;
};
