import { calendarFacts, mentionsTime } from '../utils/calendarFacts';

const TUESDAY = new Date(2026, 7, 4, 12, 0, 0);

describe('calendarFacts', () => {
  it('names the weekday the model cannot derive from an ISO date', () => {
    expect(calendarFacts(undefined, TUESDAY)).toBe(
      'Today: Tuesday, 4 August 2026 (2026-08-04)\n' +
        'Tomorrow: Wednesday, 5 August 2026 (2026-08-05)'
    );
  });

  it('keeps each fact on its own labelled line', () => {
    const lines = calendarFacts('pl', TUESDAY).split('\n');
    expect(lines[0].startsWith('Today: ')).toBe(true);
    expect(lines[1].startsWith('Tomorrow: ')).toBe(true);
  });

  it('rolls the month over rather than reporting a 32nd', () => {
    expect(calendarFacts(undefined, new Date(2026, 7, 31, 12, 0, 0))).toContain(
      'Tomorrow: Tuesday, 1 September 2026 (2026-09-01)'
    );
  });

  it('maps a week of weekday names in the language the pages are written in', () => {
    const facts = calendarFacts('pl', TUESDAY);
    expect(facts).toContain('wtorek = 2026-08-04');
    expect(facts).toContain('środa = 2026-08-05');
    expect(facts).toContain('poniedziałek = 2026-08-10');
  });

  it('falls back to the plain date when the locale is unusable', () => {
    expect(calendarFacts('not a locale', TUESDAY)).not.toContain('=');
  });
});

describe('mentionsTime', () => {
  it('recognises temporal questions across languages and diacritics', () => {
    expect(mentionsTime('What date is today?')).toBe(true);
    expect(mentionsTime('jaka pogoda jutro')).toBe(true);
    expect(mentionsTime('a co w środę?')).toBe(true);
    expect(mentionsTime('dziś czy pojutrze?')).toBe(true);
    expect(mentionsTime('Wie ist das Wetter heute?')).toBe(true);
    expect(mentionsTime('qué pasó ayer')).toBe(true);
    expect(mentionsTime('Кто канцлер сейчас?')).toBe(true);
    expect(mentionsTime('wybory 2026')).toBe(true);
  });

  it('recognises temporal questions in the non-Latin top languages', () => {
    expect(mentionsTime('आज मौसम कैसा है?')).toBe(true);
    expect(mentionsTime('कल क्या होगा')).toBe(true);
    expect(mentionsTime('آج موسم کیسا ہے؟')).toBe(true);
    expect(mentionsTime('ما هو طقس اليوم؟')).toBe(true);
    expect(mentionsTime('متى المباراة؟')).toBe(true);
    expect(mentionsTime('هوای امروز چطور است؟')).toBe(true);
    expect(mentionsTime('今天天气怎么样')).toBe(true);
    expect(mentionsTime('北京现在几点')).toBe(true);
    expect(mentionsTime('que tempo faz hoje')).toBe(true);
    expect(mentionsTime('o que aconteceu ontem')).toBe(true);
  });

  it('stays quiet for questions with no temporal angle', () => {
    expect(mentionsTime('Kto jest kanclerzem Niemiec?')).toBe(false);
    expect(mentionsTime('Explain how transformers work')).toBe(false);
    expect(mentionsTime('napisz funkcje w pythonie')).toBe(false);
    expect(mentionsTime('谁是德国总理')).toBe(false);
    expect(mentionsTime('من هو مستشار ألمانيا؟')).toBe(false);
    expect(mentionsTime('')).toBe(false);
  });
});
