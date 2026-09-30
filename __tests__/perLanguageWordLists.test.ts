import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '..');

const LANGUAGE_CODES = [
  'EN',
  'PL',
  'HI',
  'UR',
  'DE',
  'PT',
  'ES',
  'FR',
  'RU',
  'AR',
  'FA',
  'ID',
  'TR',
  'IT',
  'ZH',
  'JA',
  'KO',
];

const SCANNED_DIRECTORIES = [
  'utils',
  'constants',
  'components',
  'store',
  'hooks',
];

const PREFIXED = new RegExp(
  `^(?:export )?const ((?:${LANGUAGE_CODES.join('|')})_[A-Z0-9_]+)\\s*[:=]`,
  'gm'
);
const SUFFIXED = new RegExp(
  `^(?:export )?const ([A-Z0-9_]+_(?:${LANGUAGE_CODES.join('|')}))\\s*[:=]`,
  'gm'
);

const NOT_A_LANGUAGE = new Set(['LFM_2_5_EMBEDDING_MODEL_ID']);

interface Site {
  names: string[];
  verdict: string;
}

const KNOWN_SITES: Record<string, Site> = {
  'utils/queryTerms.ts': {
    names: [
      'EN_STOPWORDS',
      'PL_STOPWORDS',
      'HI_STOPWORDS',
      'UR_STOPWORDS',
      'DE_STOPWORDS',
      'PT_STOPWORDS',
      'ES_STOPWORDS',
      'FR_STOPWORDS',
      'RU_STOPWORDS',
      'AR_STOPWORDS',
      'FA_STOPWORDS',
      'ID_STOPWORDS',
      'TR_STOPWORDS',
      'IT_STOPWORDS',
    ],
    verdict:
      'kept on purpose: these only clean a query, they decide no behaviour. Collapsing them into one union loses English content words that are function words elsewhere — war, hat, die (de) and son (es) — so the per-language split is the precision, not the debt. See #325.',
  },
  'constants/citations.ts': {
    names: [
      'NEGATION_CUE_EN',
      'NO_ANSWER_META_EN',
      'PL_WORD_CHAR',
      'PL_NEGATED_PARTICIPLE',
      'PL_COVERAGE_NOUN',
      'NO_ANSWER_META_PL',
      'NO_ANSWER_PATTERNS_EN',
      'NO_ANSWER_PATTERNS_PL',
    ],
    verdict:
      'debt: refusal detection is English and Polish only. A reply that says it has no information is recognised in 2 of 15 languages, and in the other 13 the sources are still cited underneath it. See #325.',
  },
};

const sourceFiles = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(join(REPO_ROOT, dir), {
    withFileTypes: true,
  })) {
    const relative = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(relative));
    } else if (relative.endsWith('.ts') || relative.endsWith('.tsx')) {
      out.push(relative);
    }
  }
  return out;
};

const scanForLanguageTaggedConstants = (): Record<string, string[]> => {
  const byFile: Record<string, string[]> = {};
  for (const dir of SCANNED_DIRECTORIES) {
    for (const file of sourceFiles(dir)) {
      const text = readFileSync(join(REPO_ROOT, file), 'utf8');
      const names = [
        ...[...text.matchAll(PREFIXED)].map((match) => match[1]!),
        ...[...text.matchAll(SUFFIXED)].map((match) => match[1]!),
      ].filter((name) => !NOT_A_LANGUAGE.has(name));
      if (names.length > 0) byFile[file] = [...new Set(names)];
    }
  }
  return byFile;
};

describe('per-language word lists stay accounted for', () => {
  const found = scanForLanguageTaggedConstants();

  it('declares every file that tags a constant with a language', () => {
    expect(Object.keys(found).sort()).toEqual(Object.keys(KNOWN_SITES).sort());
  });

  it('declares every language-tagged constant, with a verdict on each site', () => {
    for (const [file, site] of Object.entries(KNOWN_SITES)) {
      expect({ file, names: (found[file] ?? []).sort() }).toEqual({
        file,
        names: [...site.names].sort(),
      });
      expect(site.verdict.length).toBeGreaterThan(0);
    }
  });
});
