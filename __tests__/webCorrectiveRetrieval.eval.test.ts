import type { WebSearchResult } from '../utils/web/types';
import type { WebSearchProvider } from '../utils/web/types';
import type { LFMEmbeddings } from '../utils/lfmEmbeddings';

jest.mock('react-native-rag', () => ({
  RecursiveCharacterTextSplitter: jest
    .fn()
    .mockImplementation(({ chunkSize }: { chunkSize: number }) => ({
      splitText: jest.fn(async (text: string) => {
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += chunkSize) {
          chunks.push(text.slice(i, i + chunkSize));
        }
        return chunks;
      }),
    })),
}));

import { runWebSearch } from '../utils/web/runWebSearch';
import { reformulateForCorrection } from '../utils/web/reformulateQuery';
import type { QueryRewriteMessage } from '../utils/web/buildSearchQuery';

const axisOf = (text: string): number[] => {
  const lower = text.toLowerCase();
  const weather = /weather|forecast|temperature|sunny|pogoda/.test(lower)
    ? 1
    : 0;
  const sport = /football|match|score|league/.test(lower) ? 1 : 0;
  const filler = weather || sport ? 0.1 : 1;
  return [weather, sport, filler];
};
const embeddings = {
  embedQuery: jest.fn(async (t: string) => axisOf(t)),
  embedDocument: jest.fn(async (t: string) => axisOf(t)),
} as unknown as LFMEmbeddings;

const onTopic = (
  url: string,
  city: string,
  marker: string | null
): WebSearchResult => ({
  title: `${city} weather`,
  url,
  snippet: marker
    ? `Latest ${city} weather update. ${marker}.`
    : `Latest ${city} weather update.`,
  content:
    `${city} weather forecast sunny temperature today conditions clear skies. `.repeat(
      12
    ),
});
const offTopic = (url: string): WebSearchResult => ({
  title: 'Sports recap',
  url,
  snippet: 'Weekend sports recap and highlights.',
  content:
    'football match score league game result recap highlights players coach. '.repeat(
      12
    ),
});
const thinPage = (url: string, city: string): WebSearchResult => ({
  title: `${city} note`,
  url,
  snippet: `${city} brief note.`,
  content: `${city} rainy conditions`,
});

type Bucket =
  'good' | 'recoverable' | 'empty' | 'hardfail' | 'missing' | 'thin';

const BUCKETS: Bucket[] = [
  ...Array<Bucket>(34).fill('good'),
  ...Array<Bucket>(24).fill('recoverable'),
  ...Array<Bucket>(10).fill('empty'),
  ...Array<Bucket>(12).fill('hardfail'),
  ...Array<Bucket>(12).fill('missing'),
  ...Array<Bucket>(8).fill('thin'),
];

interface Scenario {
  i: number;
  bucket: Bucket;
  query: string;
  marker: string;
  round1: WebSearchResult[];
  corrective: WebSearchResult[];
}

const buildScenario = (i: number, bucket: Bucket): Scenario => {
  const city = `city${i}`;
  const marker = `ANS${String(i).padStart(3, '0')}`;
  const query = `${city} weather forecast`;
  const u = (s: string) => `https://s${i}-${s}.example`;

  switch (bucket) {
    case 'good':
      return {
        i,
        bucket,
        query,
        marker,
        round1: [onTopic(u('a'), city, marker), onTopic(u('b'), city, marker)],
        corrective: [],
      };
    case 'missing':
      return {
        i,
        bucket,
        query,
        marker,
        round1: [onTopic(u('a'), city, null), onTopic(u('b'), city, null)],
        corrective: [onTopic(u('c'), city, marker)],
      };
    case 'recoverable':
      return {
        i,
        bucket,
        query,
        marker,
        round1: [offTopic(u('a')), offTopic(u('b'))],
        corrective: [onTopic(u('c'), city, marker)],
      };
    case 'empty':
      return {
        i,
        bucket,
        query,
        marker,
        round1: [],
        corrective: [onTopic(u('c'), city, marker)],
      };
    case 'hardfail':
      return {
        i,
        bucket,
        query,
        marker,
        round1: [offTopic(u('a'))],
        corrective: [offTopic(u('b'))],
      };
    case 'thin':
      return {
        i,
        bucket,
        query,
        marker,
        round1: [thinPage(u('a'), city)],
        corrective: [onTopic(u('c'), city, marker)],
      };
  }
};

class FixtureProvider implements WebSearchProvider {
  readonly id = 'fixture';
  calls = 0;
  private map: Record<string, WebSearchResult[]>;
  constructor(scenario: Scenario, withCorrective: boolean) {
    const correctiveKey = reformulateForCorrection(
      scenario.query,
      { intent: '', queries: [scenario.query] },
      [scenario.query]
    );
    this.map = { [scenario.query]: scenario.round1 };
    if (withCorrective && correctiveKey) {
      this.map[correctiveKey] = scenario.corrective;
    }
  }
  isReady() {
    return true;
  }
  async search(query: string): Promise<WebSearchResult[]> {
    this.calls += 1;
    return this.map[query] ?? [];
  }
}

const noGen = async () => '';

const run = (scenario: Scenario, withCorrective: boolean) =>
  runWebSearch({
    query: scenario.query,
    history: [],
    provider: new FixtureProvider(scenario, withCorrective),
    embeddings,
    embeddingModelReady: true,
    generate: noGen,
    today: '2026-07-20',
  });

const contains = (context: string[], marker: string): boolean =>
  context.join('\n').includes(marker);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => (console.warn as jest.Mock).mockRestore());

describe('CRAG corrective retrieval — 100-search benchmark', () => {
  it('improves answer recall with bounded, precise corrective rounds', async () => {
    const scenarios = BUCKETS.map((bucket, i) => buildScenario(i, bucket));

    const rows = await Promise.all(
      scenarios.map(async (scenario) => {
        const full = await run(scenario, true);
        const base = await run(scenario, false);
        const baselinePresent = contains(base.context, scenario.marker);
        const correctivePresent = contains(full.context, scenario.marker);
        return {
          bucket: scenario.bucket,
          baselinePresent,
          correctivePresent,
          fired: full.telemetry.correctiveFired,
          providerCalls: full.telemetry.providerCalls,
          insufficient: !baselinePresent,
        };
      })
    );

    const N = rows.length;
    let tp = 0;
    let fp = 0;
    let fn = 0;
    let tn = 0;
    let baselineHits = 0;
    let correctiveHits = 0;
    let fired = 0;
    let regressions = 0;
    let maxCalls = 0;

    for (const r of rows) {
      if (r.fired) fired += 1;
      if (r.insufficient && r.fired) tp += 1;
      else if (!r.insufficient && r.fired) fp += 1;
      else if (r.insufficient && !r.fired) fn += 1;
      else tn += 1;
      if (r.baselinePresent) baselineHits += 1;
      if (r.correctivePresent) correctiveHits += 1;
      if (r.baselinePresent && !r.correctivePresent) regressions += 1;
      maxCalls = Math.max(maxCalls, r.providerCalls);
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
    const f1 =
      precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;
    const baselineRecall = baselineHits / N;
    const correctiveRecall = correctiveHits / N;
    const lift = correctiveRecall - baselineRecall;
    const fireRate = fired / N;

    const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

    console.log(
      [
        '',
        '=== CRAG corrective retrieval — 100-search benchmark ===',
        `scenarios:            ${N}`,
        `evaluator confusion:  TP=${tp} FP=${fp} FN=${fn} TN=${tn}`,
        `evaluator precision:  ${pct(precision)}`,
        `evaluator recall:     ${pct(recall)}`,
        `evaluator F1:         ${f1.toFixed(3)}`,
        `answer recall (base): ${pct(baselineRecall)}`,
        `answer recall (CRAG): ${pct(correctiveRecall)}`,
        `net recall lift:      +${pct(lift)}`,
        `corrective fire-rate: ${pct(fireRate)}`,
        `regressions:          ${regressions}`,
        `max provider calls:   ${maxCalls}`,
        '========================================================',
      ].join('\n')
    );

    expect(N).toBe(100);
    expect(regressions).toBe(0);
    expect(maxCalls).toBeLessThanOrEqual(2);
    expect(lift).toBeGreaterThanOrEqual(0.1);
    expect(precision).toBeGreaterThanOrEqual(0.8);
    expect(recall).toBeGreaterThanOrEqual(0.6);
    expect(f1).toBeGreaterThanOrEqual(0.7);
    expect(fired).toBeGreaterThan(0);
    expect(fired).toBeLessThan(N);
  }, 60000);
});

const LEAD_COUNT = 20;

interface LeadScenario {
  query: string;
  marker: string;
  agency: string;
  round1: WebSearchResult[];
  corrective: WebSearchResult[];
  leadQuery: string;
}

const buildLeadScenario = (i: number): LeadScenario => {
  const city = `city${i}`;
  const agency = `METEO${100 + i}`;
  const marker = `LEAD${String(i).padStart(3, '0')}`;
  return {
    query: `${city} weather forecast`,
    marker,
    agency,
    round1: [
      {
        title: `${city} information portal`,
        url: `https://lead${i}-a.example`,
        snippet: `${city} general information.`,
        content:
          `${city} readings are not held here. Official measurements for ${city} are published by the ${agency} agency and mirrored on its portal. `.repeat(
            6
          ),
      },
    ],
    corrective: [onTopic(`https://lead${i}-c.example`, city, marker)],
    leadQuery: `${agency} ${city} weather`,
  };
};

const evidenceGen = async (
  messages: QueryRewriteMessage[]
): Promise<string> => {
  const user = messages[messages.length - 1]?.content ?? '';
  if (!user.includes('Excerpts:')) return '';
  const agency = /METEO\d+/.exec(user)?.[0];
  const city = /Question:\s*(city\d+)/.exec(user)?.[1];
  if (!agency || !city) return '{"query": ""}';
  return `{"query": "${agency} ${city} weather"}`;
};

class LeadProvider implements WebSearchProvider {
  readonly id = 'lead-fixture';
  calls = 0;
  private map: Record<string, WebSearchResult[]>;
  constructor(scenario: LeadScenario, serveCorrective: boolean) {
    this.map = { [scenario.query]: scenario.round1 };
    if (serveCorrective) {
      this.map[scenario.leadQuery] = scenario.corrective;
    }
  }
  isReady() {
    return true;
  }
  async search(query: string): Promise<WebSearchResult[]> {
    this.calls += 1;
    return this.map[query] ?? [];
  }
}

describe('evidence-driven corrective query — lead recovery', () => {
  it('recovers leads the deterministic rewrite provably cannot reach', async () => {
    const scenarios = Array.from({ length: LEAD_COUNT }, (_, i) =>
      buildLeadScenario(i)
    );

    const rows = await Promise.all(
      scenarios.map(async (scenario) => {
        const withEvidence = await runWebSearch({
          query: scenario.query,
          history: [],
          provider: new LeadProvider(scenario, true),
          embeddings,
          embeddingModelReady: true,
          generate: evidenceGen,
          today: '2026-07-20',
        });
        const heuristicOnly = await runWebSearch({
          query: scenario.query,
          history: [],
          provider: new LeadProvider(scenario, true),
          embeddings,
          embeddingModelReady: true,
          generate: noGen,
          today: '2026-07-20',
        });
        return {
          evidenceHit: contains(withEvidence.context, scenario.marker),
          heuristicHit: contains(heuristicOnly.context, scenario.marker),
          fired: withEvidence.telemetry.correctiveFired,
          source: withEvidence.telemetry.correctiveSource,
          calls: withEvidence.telemetry.providerCalls,
        };
      })
    );

    const N = rows.length;
    const evidenceHits = rows.filter((r) => r.evidenceHit).length;
    const heuristicHits = rows.filter((r) => r.heuristicHit).length;
    const fired = rows.filter((r) => r.fired).length;
    const fromEvidence = rows.filter((r) => r.source === 'evidence').length;
    const maxCalls = Math.max(...rows.map((r) => r.calls));
    const pct = (x: number) => `${((x / N) * 100).toFixed(1)}%`;

    console.log(
      [
        '',
        '=== Evidence-driven corrective query — lead recovery ===',
        `scenarios:              ${N}`,
        `answer recall (heuristic rewrite): ${pct(heuristicHits)}`,
        `answer recall (evidence rewrite):  ${pct(evidenceHits)}`,
        `net recall lift:        +${pct(evidenceHits - heuristicHits)}`,
        `corrective fired:       ${pct(fired)}`,
        `query from evidence:    ${pct(fromEvidence)}`,
        `max provider calls:     ${maxCalls}`,
        '=======================================================',
      ].join('\n')
    );

    expect(fired).toBe(N);
    expect(heuristicHits).toBe(0);
    expect(evidenceHits).toBe(N);
    expect(fromEvidence).toBe(N);
    expect(maxCalls).toBeLessThanOrEqual(2);
  }, 60000);
});

const LANG_COUNT = 20;

const italianThin = (i: number, city: string): WebSearchResult[] => [
  {
    title: `Cattedrale di ${city} - Wikipedia`,
    url: `https://it.wikipedia.org/wiki/${city}`,
    snippet: `${city} breve nota.`,
    content: `${city} nota breve`,
  },
  {
    title: `Duomo di ${city}`,
    url: `https://duomo${i}.it/`,
    snippet: `${city} pagina ufficiale.`,
    content: `${city} nota`,
  },
];

const neutralThin = (i: number, city: string): WebSearchResult[] => [
  {
    title: `Cathedral of ${city} - Encyclopedia`,
    url: `https://encyclopedia${i}.com/${city}`,
    snippet: `${city} short note.`,
    content: `${city} short note`,
  },
  {
    title: `${city} Cathedral`,
    url: `https://guide${i}.com/`,
    snippet: `${city} official page.`,
    content: `${city} note`,
  },
];

const plannerOnlyGen = async (
  messages: QueryRewriteMessage[]
): Promise<string> => {
  const user = messages[messages.length - 1]?.content ?? '';
  if (user.includes('Excerpts:')) return 'sorry, I am not sure';
  const city = /(city\d+)/.exec(user)?.[1] ?? '';
  return JSON.stringify({
    needs_search: true,
    intent: 'cathedral weather',
    queries: [`${city} weather forecast`],
  });
};

class LangProvider implements WebSearchProvider {
  readonly id = 'lang-fixture';
  private map: Record<string, WebSearchResult[]>;
  constructor(map: Record<string, WebSearchResult[]>) {
    this.map = map;
  }
  isReady() {
    return true;
  }
  async search(query: string): Promise<WebSearchResult[]> {
    return this.map[query] ?? [];
  }
}

describe('corrective round — language switch', () => {
  it('recovers an answer that only exists in the topic language, with a useless model', async () => {
    const rows = await Promise.all(
      Array.from({ length: LANG_COUNT }, async (_, i) => {
        const city = `city${i}`;
        const marker = `LANG${String(i).padStart(3, '0')}`;
        const planned = `${city} weather forecast`;
        const nativeQuery = `Cattedrale di ${city}`;

        const withLanguage = await runWebSearch({
          query: `Jaka jest pogoda w ${city}?`,
          history: [],
          provider: new LangProvider({
            [planned]: italianThin(i, city),
            [nativeQuery]: [onTopic(`https://it${i}.example/`, city, marker)],
          }),
          embeddings,
          embeddingModelReady: true,
          generate: plannerOnlyGen,
          today: '2026-07-20',
        });

        const control = await runWebSearch({
          query: `Jaka jest pogoda w ${city}?`,
          history: [],
          provider: new LangProvider({
            [planned]: neutralThin(i, city),
            [nativeQuery]: [onTopic(`https://it${i}.example/`, city, marker)],
          }),
          embeddings,
          embeddingModelReady: true,
          generate: plannerOnlyGen,
          today: '2026-07-20',
        });

        return {
          hit: contains(withLanguage.context, marker),
          controlHit: contains(control.context, marker),
          source: withLanguage.telemetry.correctiveSource,
          language: withLanguage.telemetry.correctiveLanguage,
          controlLanguage: control.telemetry.correctiveLanguage,
          calls: withLanguage.telemetry.providerCalls,
        };
      })
    );

    const N = rows.length;
    const hits = rows.filter((r) => r.hit).length;
    const controlHits = rows.filter((r) => r.controlHit).length;
    const viaNative = rows.filter((r) => r.source === 'native-title').length;
    const pct = (x: number) => `${((x / N) * 100).toFixed(1)}%`;

    console.log(
      [
        '',
        '=== Corrective round — language switch ===',
        `scenarios:               ${N}`,
        `answer recall (control, neutral hosts): ${pct(controlHits)}`,
        `answer recall (topic-language hosts):   ${pct(hits)}`,
        `recovered via native title:             ${pct(viaNative)}`,
        `max provider calls:      ${Math.max(...rows.map((r) => r.calls))}`,
        '==========================================',
      ].join('\n')
    );

    expect(hits).toBe(N);
    expect(viaNative).toBe(N);
    expect(controlHits).toBe(0);
    expect(rows.every((r) => r.language === 'Italian')).toBe(true);
    expect(rows.every((r) => r.controlLanguage === 'English')).toBe(true);
    expect(Math.max(...rows.map((r) => r.calls))).toBeLessThanOrEqual(2);
  }, 60000);
});

const RELIABILITY_COUNT = 20;

const meteo = (
  url: string,
  city: string,
  marker: string,
  unique: number
): WebSearchResult => ({
  title: `${city} weather`,
  url,
  snippet: `${city} weather now 21 °C. Station reading ${unique} mm rainfall. ${marker}.`,
  content:
    `${city} weather forecast sunny temperature today conditions clear skies 21 °C. `.repeat(
      8
    ),
});

describe('source reliability — publisher independence', () => {
  it('separates three publishers from one publisher wearing three hats', async () => {
    const rows = await Promise.all(
      Array.from({ length: RELIABILITY_COUNT }, async (_, i) => {
        const city = `city${i}`;
        const marker = `REL${String(i).padStart(3, '0')}`;
        const query = `${city} weather forecast`;
        const pages = (host: (s: string) => string) => [
          meteo(host('a'), city, marker, 10 + i),
          meteo(host('b'), city, marker, 20 + i),
          meteo(host('c'), city, marker, 30 + i),
        ];

        const searchWith = (host: (s: string) => string) =>
          runWebSearch({
            query,
            history: [],
            provider: new LangProvider({ [query]: pages(host) }),
            embeddings,
            embeddingModelReady: true,
            generate: async () =>
              JSON.stringify({
                needs_search: true,
                intent: 'weather',
                queries: [query],
              }),
            today: '2026-07-20',
          });

        const echo = await searchWith((s) => `https://${s}.echo${i}.example/`);
        const control = await searchWith((s) => `https://${s}${i}.example/`);

        return { echo, control, marker };
      })
    );

    const N = rows.length;
    const shared = (searchWith: (typeof rows)[number]['echo']) =>
      searchWith.telemetry.agreement.corroborated.find(
        (claim) => claim.value === '21' && claim.unit === '°c'
      );

    const echoHosts = rows.map(
      (r) => r.echo.telemetry.agreement.independentHosts
    );
    const controlHosts = rows.map(
      (r) => r.control.telemetry.agreement.independentHosts
    );
    const echoCorroborated = rows.filter((r) => shared(r.echo)).length;
    const controlCorroborated = rows.filter((r) => shared(r.control)).length;
    const echoAnswers = rows.filter((r) =>
      contains(r.echo.context, r.marker)
    ).length;
    const controlAnswers = rows.filter((r) =>
      contains(r.control.context, r.marker)
    ).length;
    const echoFired = rows.filter(
      (r) => r.echo.telemetry.correctiveFired
    ).length;
    const controlFired = rows.filter(
      (r) => r.control.telemetry.correctiveFired
    ).length;
    const maxCalls = Math.max(
      ...rows.flatMap((r) => [
        r.echo.telemetry.providerCalls,
        r.control.telemetry.providerCalls,
      ])
    );
    const pct = (x: number) => `${((x / N) * 100).toFixed(1)}%`;

    console.log(
      [
        '',
        '=== Source reliability — publisher independence ===',
        `scenarios (× 2 arms):            ${N}`,
        `independent publishers (echo):   ${Math.min(...echoHosts)}–${Math.max(...echoHosts)}`,
        `independent publishers (control):${Math.min(...controlHosts)}–${Math.max(...controlHosts)}`,
        `shared figure corroborated (echo):    ${pct(echoCorroborated)}`,
        `shared figure corroborated (control): ${pct(controlCorroborated)}`,
        `unique figures single-sourced:   ${rows[0].control.telemetry.agreement.singleSourced.length} per searchWith`,
        `agreement ratio (control):       ${rows[0].control.telemetry.agreement.agreementRatio.toFixed(2)}`,
        `answer recall (echo / control):  ${pct(echoAnswers)} / ${pct(controlAnswers)}`,
        `corrective fired (echo/control): ${pct(echoFired)} / ${pct(controlFired)}`,
        `max provider calls:              ${maxCalls}`,
        '==================================================',
      ].join('\n')
    );

    expect(echoHosts.every((count) => count === 1)).toBe(true);
    expect(controlHosts.every((count) => count === 3)).toBe(true);
    expect(echoCorroborated).toBe(0);
    expect(controlCorroborated).toBe(N);
    expect(shared(rows[0].control)!.hosts).toHaveLength(3);
    expect(
      rows[0].control.telemetry.agreement.singleSourced.length
    ).toBeGreaterThan(0);
    expect(echoAnswers).toBe(N);
    expect(controlAnswers).toBe(N);
    expect(maxCalls).toBeLessThanOrEqual(2);
  }, 60000);
});
