import { localISO } from './todayISO';

const REFERENCE_LOCALE = 'en-GB';
const WEEKDAY_SPAN_DAYS = 7;
const FULL_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
};

const format = (
  date: Date,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string => {
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return '';
  }
};

const RAW_TEMPORAL_STEMS = (
  'dzis jutr pojutrz wczoraj przedwczoraj teraz obecn aktualn kiedy dat dzien dnia dni tydzien tygodn weekend ' +
  'poniedzial wtor srod czwart piat sobot niedziel ' +
  'today tomorrow yesterday now current latest when day week tonight ' +
  'monday tuesday wednesday thursday friday saturday sunday ' +
  'heute morgen gestern jetzt aktuell wann montag dienstag mittwoch donnerstag freitag samstag sonntag ' +
  'aujourd demain hier maintenant actuel quand ' +
  'hoy manana ayer ahora actualmente cuando fecha ' +
  'hoje amanha ontem agora atualmente ' +
  'oggi domani ieri adesso quando ' +
  'dnes zitra vcera kdy ' +
  'сегодня завтра вчера сейчас когда дата сьогодні вчора зараз коли ' +
  'आज कल अभी कब तारीख सप्ताह ' +
  'آج کل ابھی کب تاریخ ہفتہ ' +
  'اليوم غدا أمس امس الآن الان متى تاريخ أسبوع اسبوع ' +
  'امروز فردا دیروز اکنون تاریخ هفته'
).split(' ');

const HAN_TEMPORAL = [
  '今天',
  '明天',
  '昨天',
  '现在',
  '現在',
  '当前',
  '當前',
  '最新',
  '日期',
  '星期',
  '几号',
  '幾號',
  '周末',
];

const TEMPORAL_TAIL_MAX = 3;

let temporalStems: string[] | null = null;

const isTemporalToken = (token: string): boolean => {
  temporalStems ??= RAW_TEMPORAL_STEMS.map(foldTemporal);
  return temporalStems.some(
    (stem) =>
      token.startsWith(stem) && token.length - stem.length <= TEMPORAL_TAIL_MAX
  );
};

const YEAR = /\b20\d\d\b/;

const foldTemporal = (text: string): string => {
  const lower = text.toLowerCase();
  try {
    return lower.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
  } catch {
    return lower.replace(/ł/g, 'l');
  }
};

const shortScriptToken = /[\p{Script=Arabic}\p{Script=Devanagari}]/u;
const isTokenLongEnough = (token: string): boolean =>
  token.length >= 3 || (token.length === 2 && shortScriptToken.test(token));

export const mentionsTime = (question: string): boolean => {
  if (YEAR.test(question)) return true;
  if (HAN_TEMPORAL.some((word) => question.includes(word))) return true;
  const folded = foldTemporal(question);
  return folded
    .split(/[^\p{L}\p{M}\p{N}']+/u)
    .filter(isTokenLongEnough)
    .some(isTemporalToken);
};

const dateLine = (label: string, date: Date): string => {
  const long = format(date, REFERENCE_LOCALE, FULL_DATE);
  return `${label}: ${long ? `${long} (${localISO(date)})` : localISO(date)}`;
};

export const calendarFacts = (
  sourceLanguage?: string,
  now: Date = new Date()
): string => {
  const lines = [dateLine('Today', now), dateLine('Tomorrow', addDays(now, 1))];

  if (!sourceLanguage) return lines.join('\n');

  const days: string[] = [];
  for (let offset = 0; offset < WEEKDAY_SPAN_DAYS; offset += 1) {
    const date = addDays(now, offset);
    const name = format(date, sourceLanguage, { weekday: 'long' });
    if (!name) return lines.join('\n');
    days.push(`${name} = ${localISO(date)}`);
  }
  lines.push(`Weekday names used by the pages: ${days.join(', ')}`);
  return lines.join('\n');
};
