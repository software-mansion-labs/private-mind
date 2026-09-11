import { detectQuestionLanguage } from '../utils/questionLanguage';
import {
  MULTILINGUAL_SCENARIOS,
  ALL_LANGS,
} from './fixtures/multilingualQueries';

const pct = (hit: number, total: number): number =>
  total === 0 ? 0 : Math.round((hit / total) * 100);

const detected = (question: string): string =>
  detectQuestionLanguage(question)?.code ?? '—';

describe('detectQuestionLanguage over the labelled corpus', () => {
  it('names the language of a real question in every language we ship to', () => {
    const rows: string[] = [
      '',
      '=== QUESTION LANGUAGE (labelled corpus) ===',
      'lang   n   correct   misses',
    ];
    let hits = 0;
    let total = 0;

    for (const lang of ALL_LANGS) {
      const items = MULTILINGUAL_SCENARIOS.filter((s) => s.lang === lang);
      const wrong = items.filter((s) => detected(s.query) !== s.lang);
      hits += items.length - wrong.length;
      total += items.length;
      rows.push(
        `${lang.padEnd(4)} ${String(items.length).padStart(3)}   ` +
          `${String(pct(items.length - wrong.length, items.length)).padStart(6)}%   ` +
          (wrong
            .map((s) => `${detected(s.query)}<-"${s.query.slice(0, 34)}"`)
            .join('  ') || '-')
      );
    }
    rows.push(`OVERALL ${String(pct(hits, total)).padStart(9)}%`, '');
    process.stdout.write(rows.join('\n') + '\n');

    expect(pct(hits, total)).toBeGreaterThanOrEqual(90);
  });
});

describe('where question-language detection is weak', () => {
  const CASES: { label: string; question: string; want: string }[] = [
    {
      label: 'ascii de (android)',
      question: 'Wie viele Einwohner hat Munchen',
      want: 'de',
    },
    {
      label: 'ascii pl (android)',
      question: 'Ile kosztuje bilet do Krakowa',
      want: 'pl',
    },
    {
      label: 'ascii tr (android)',
      question: "Istanbul'un nufusu kac",
      want: 'tr',
    },
    {
      label: 'ascii es (android)',
      question: 'Cuanto cuesta el iPhone en Espana',
      want: 'es',
    },
    {
      label: 'ascii fr (android)',
      question: "Combien coute l'iPhone en France",
      want: 'fr',
    },
    {
      label: 'ascii pt (android)',
      question: 'Quantos habitantes tem Sao Paulo',
      want: 'pt',
    },
    { label: 'short pl', question: 'Kto to?', want: 'pl' },
    { label: 'short de', question: 'Wie spat?', want: 'de' },
    {
      label: 'keywords only pl',
      question: 'Samsung Galaxy S25 cena',
      want: 'pl',
    },
    { label: 'proper nouns only', question: 'iPhone 17 Pro 256GB', want: '—' },
    {
      label: 'hinglish',
      question: 'Mumbai ki population kitni hai',
      want: 'en',
    },
    {
      label: 'code switch pl/en',
      question: 'Jaka jest cena iPhone 17 Pro w Apple Store',
      want: 'pl',
    },
    { label: 'urdu vs arabic', question: 'کراچی کی آبادی کتنی ہے', want: 'ur' },
    {
      label: 'persian vs arabic',
      question: 'جمعیت تهران چقدر است',
      want: 'fa',
    },
    { label: 'arabic', question: 'كم عدد سكان الرياض', want: 'ar' },
    {
      label: 'pt vs es',
      question: 'Quanto custa o iPhone no Brasil',
      want: 'pt',
    },
    {
      label: 'es vs pt',
      question: 'Cuanto cuesta el iPhone en Mexico',
      want: 'es',
    },
    {
      label: 'ukrainian vs russian',
      question: 'Скільки коштує квиток',
      want: 'uk',
    },
    { label: 'japanese', question: '東京の人口は何人ですか', want: 'ja' },
    { label: 'chinese', question: '上海有多少人口', want: 'zh' },
  ];

  it('reports which shapes it reads and which it does not', () => {
    const rows: string[] = [
      '',
      '=== WEAK SPOTS ===',
      'case                     want  got   ok',
    ];
    const failures: string[] = [];
    for (const { label, question, want } of CASES) {
      const got = detected(question);
      const ok = got === want;
      if (!ok) failures.push(`${label}: want ${want}, got ${got}`);
      rows.push(
        `${label.padEnd(24)} ${want.padEnd(5)} ${got.padEnd(5)} ${ok ? 'ok' : 'MISS'}`
      );
    }
    rows.push(
      `MISSES ${failures.length}/${CASES.length}`,
      ...failures.map((f) => `  ${f}`),
      ''
    );
    process.stdout.write(rows.join('\n') + '\n');

    expect(CASES.length).toBeGreaterThan(0);
  });
});
