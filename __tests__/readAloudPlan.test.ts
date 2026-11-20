import { READ_ALOUD_VOICES } from '../constants/read-aloud';
import { isReadAloudLanguage, readAloudPlanFor } from '../utils/readAloudPlan';

const answer = (content: string) => ({
  role: 'assistant' as const,
  content,
});

describe('readAloudPlanFor', () => {
  it('names the language and its preset voice for an English answer', () => {
    const plan = readAloudPlanFor(
      answer('The weather today is sunny and the temperature will be warm.')
    );
    expect(plan).toEqual({
      text: 'The weather today is sunny and the temperature will be warm.',
      language: 'en',
      voice: READ_ALOUD_VOICES.en,
    });
  });

  it('recognises a Polish answer', () => {
    const plan = readAloudPlanFor(
      answer('Dzisiaj jest ładna pogoda, a jutro będzie jeszcze cieplej.')
    );
    expect(plan?.language).toBe('pl');
    expect(plan?.voice).toBe(READ_ALOUD_VOICES.pl);
  });

  it('recognises a German answer', () => {
    const plan = readAloudPlanFor(
      answer('Das Wetter ist heute schön und morgen wird es wärmer.')
    );
    expect(plan?.language).toBe('de');
  });

  it('offers nothing for a language Reverb does not speak', () => {
    expect(
      readAloudPlanFor(answer('Сегодня хорошая погода и завтра будет теплее.'))
    ).toBeNull();
    expect(
      readAloudPlanFor(
        answer('今日は天気が良くて、明日はもっと暖かくなります。')
      )
    ).toBeNull();
  });

  it('offers nothing for a user message', () => {
    expect(
      readAloudPlanFor({ role: 'user', content: 'What is the weather today?' })
    ).toBeNull();
  });

  it('offers nothing when only code or thinking is left', () => {
    expect(readAloudPlanFor(answer('```\nconst a = 1;\n```'))).toBeNull();
    expect(readAloudPlanFor(answer('<think>hmm</think>'))).toBeNull();
  });

  it('speaks the cleaned text, not the markdown', () => {
    const plan = readAloudPlanFor(
      answer('## Weather\n\nToday is **sunny** and the sky is clear [1].')
    );
    expect(plan?.text).toBe('Weather. Today is sunny and the sky is clear.');
  });
});

describe('isReadAloudLanguage', () => {
  it('accepts exactly the seven Reverb languages', () => {
    for (const code of ['de', 'en', 'es', 'fr', 'it', 'pl', 'pt']) {
      expect(isReadAloudLanguage(code)).toBe(true);
    }
    for (const code of ['nl', 'ru', 'toString', '']) {
      expect(isReadAloudLanguage(code)).toBe(false);
    }
  });
});
