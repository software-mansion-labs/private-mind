import type { WebSearchTelemetry } from '../utils/web/runWebSearch';
import {
  recordWebSearchTrace,
  type WebSearchTrace,
} from '../utils/web/searchTrace';
import { writtenFiles } from '../__mocks__/react-native-fs';

const telemetry: WebSearchTelemetry = {
  needsSearch: true,
  intent: 'who holds the office now',
  plannedQueries: ['presidente del consiglio in carica'],
  rounds: [],
  providerCalls: 1,
  enginesTried: ['duckduckgo'],
  finalConfidence: 0.4,
  finalLabel: 'ambiguous',
  agreement: {
    independentHosts: 1,
    repeatedHostResults: 0,
    corroborated: [],
    singleSourced: [],
    agreementRatio: 0,
  },
  fetchFailures: [],
  recovery: [],
};

const trace = (question: string): WebSearchTrace => ({
  question,
  expects: ['name of the office holder'],
  planQueries: ['presidente del consiglio in carica'],
  budget: 2000,
  contextOffset: 0,
  candidates: [
    'https://it.wikipedia.org/wiki/Presidenti',
    'https://www.governo.it/it/il-presidente',
  ],
  results: [
    {
      title: 'Presidenti del Consiglio',
      url: 'https://it.wikipedia.org/wiki/Presidenti',
      snippet: 'dal 1861 a oggi',
      content: 'Fernando Tambroni ... Giorgia Meloni, in carica',
      sourceQuery: 'presidente del consiglio in carica',
    },
  ],
  context: ['[1] Presidenti del Consiglio\nGiorgia Meloni, in carica'],
  telemetry,
});

beforeEach(() => {
  writtenFiles.clear();
});

describe('recordWebSearchTrace', () => {
  it('ships off, so a release build writes nothing', async () => {
    await recordWebSearchTrace(trace('chi e il presidente del consiglio'));

    expect(writtenFiles.size).toBe(0);
  });

  it('lands in the directory adb can read off a release build', async () => {
    await recordWebSearchTrace(trace('chi e il presidente del consiglio'), {
      toFile: true,
    });

    const [path] = [...writtenFiles.keys()];
    expect(path).toMatch(/^\/sdcard\/Android\/data\/app\/files\/web-traces\//);
  });

  it('records the page text and the context the model was handed', async () => {
    await recordWebSearchTrace(trace('chi e il presidente del consiglio'), {
      toFile: true,
    });

    const parsed = JSON.parse([...writtenFiles.values()][0]!);
    expect(parsed.sources[0].url).toBe(
      'https://it.wikipedia.org/wiki/Presidenti'
    );
    expect(parsed.sources[0].content).toContain('Tambroni');
    expect(parsed.candidates).toContain(
      'https://www.governo.it/it/il-presidente'
    );
    expect(parsed.budget).toBe(2000);
    expect(parsed.context[0]).toContain('in carica');
    expect(parsed.telemetry.finalLabel).toBe('ambiguous');
  });

  it('drops the oldest traces, not the alphabetically first', async () => {
    jest.useFakeTimers();

    for (const question of ['ccc', 'bbb', 'aaa']) {
      jest.advanceTimersByTime(60_000);
      await recordWebSearchTrace(trace(question), {
        toFile: true,
        keepFiles: 2,
      });
    }
    jest.useRealTimers();

    const questions = [...writtenFiles.values()].map(
      (body) => JSON.parse(body).question
    );
    expect(questions).toEqual(['bbb', 'aaa']);
  });
});
