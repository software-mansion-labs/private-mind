import {
  compareWithPreviousRuns,
  copyForAiMarkdown,
  failedTurnRecords,
  failedTurnSentence,
  loadSavedRuns,
  modelIssues,
  passedTurnCount,
  regressionSentence,
  reportFileName,
  saveRunReport,
} from '../utils/devBenchmark/report';
import type {
  BenchmarkRun,
  CheckFinding,
  ModelResult,
  TurnAttempt,
  TurnResult,
} from '../utils/devBenchmark/types';
import { readDir, writtenFiles } from '../__mocks__/react-native-fs';

const loopFinding: CheckFinding = {
  check: 'loop',
  severity: 'fail',
  expected: 'no line or sentence repeated 3 times',
  actual: '"sleep early" ×3',
};

const retryFinding: CheckFinding = {
  check: 'guard-retry',
  severity: 'warn',
  expected: 'no guard retry',
  actual: 'Dangling list answer (accepted)',
};

const attempt = (overrides: Partial<TurnAttempt> = {}): TurnAttempt => ({
  raw: 'Answer.',
  tidied: 'Answer.',
  final: 'Answer.',
  retries: [],
  generationError: null,
  timings: { ttftMs: 500, tokPerS: 20, turnMs: 10_000 },
  systemChars: 1200,
  promptMessages: 4,
  findings: [],
  ...overrides,
});

const turn = (index: number, overrides: Partial<TurnResult> = {}) => ({
  index,
  prompt: `question ${index + 1}`,
  verdict: 'pass' as const,
  attempts: [attempt()],
  ...overrides,
});

const model = (overrides: Partial<ModelResult> = {}): ModelResult => ({
  modelId: 1,
  modelName: 'Qwen 3 0.6B',
  modelSizeGB: 0.6,
  verdict: 'pass',
  loadMs: 2000,
  speed: { tokPerS: 30, ttftMs: 200, peakMemoryBytes: 1024 ** 3 },
  scenarios: [
    {
      scenarioId: 'base-chat',
      title: 'Base chat',
      verdict: 'pass',
      turns: [turn(0), turn(1)],
    },
  ],
  ...overrides,
});

const run = (overrides: Partial<BenchmarkRun> = {}): BenchmarkRun => ({
  startedAt: '2026-10-02T10:00:00.000Z',
  finishedAt: '2026-10-02T10:20:00.000Z',
  appVersion: '1.3.1',
  build: '42',
  mode: 'full',
  device: {
    id: 'device-a',
    name: 'Pixel 9',
    platform: 'android',
    osVersion: '16',
    ramGB: 12,
  },
  models: [model()],
  ...overrides,
});

const loopingRaw =
  'Sleep early. Sleep early. Sleep early. Sleep early. Sleep early.';

const runWithFailures = (): BenchmarkRun =>
  run({
    models: [
      model({
        verdict: 'fail',
        scenarios: [
          {
            scenarioId: 'base-chat',
            title: 'Base chat',
            verdict: 'fail',
            turns: [
              turn(0),
              turn(1, {
                verdict: 'fail',
                attempts: [
                  attempt({
                    raw: `${loopingRaw}<|im_end|>`,
                    tidied: 'Sleep early.',
                    final: 'Sleep early.<|im_end|>',
                    findings: [loopFinding, retryFinding],
                  }),
                  attempt({ findings: [loopFinding] }),
                ],
              }),
              turn(2, {
                verdict: 'warn',
                attempts: [
                  attempt({ findings: [loopFinding] }),
                  attempt({ findings: [] }),
                ],
              }),
              turn(3, {
                verdict: 'warn',
                attempts: [attempt({ findings: [retryFinding] })],
              }),
              turn(4, { verdict: 'fail', attempts: [] }),
            ],
          },
        ],
      }),
    ],
  });

describe('failedTurnRecords', () => {
  const records = failedTurnRecords(runWithFailures());

  it('keeps only the turns that were not green', () => {
    expect(records.map((record) => record.turn)).toEqual([2, 3, 4]);
  });

  it('carries the full trace of the first attempt in the planned shape', () => {
    expect(records[0]).toEqual({
      build: '1.3.1 (42)',
      device: 'Pixel 9 · android 16 · 12 GB',
      model: 'Qwen 3 0.6B',
      scenario: 'Base chat',
      turn: 2,
      check: 'loop',
      severity: 'fail',
      expected: loopFinding.expected,
      actual: loopFinding.actual,
      alsoFound: ['guard-retry'],
      question: 'question 2',
      raw: `${loopingRaw}<|im_end|>`,
      tidied: 'Sleep early.',
      final: 'Sleep early.<|im_end|>',
      retries: [],
      guards: { loopCut: true, specialTokens: ['<|im_end|>'] },
      prompt: { systemChars: 1200, historyTurns: 2, lastUser: 'question 2' },
      timings: { ttftMs: 500, tokPerS: 20, turnMs: 10_000 },
      retriedOnce: true,
      passedOnRetry: false,
    });
  });

  it('marks a failure that passed on its retry', () => {
    expect(records[1]).toMatchObject({
      severity: 'warn',
      retriedOnce: true,
      passedOnRetry: true,
    });
  });

  it('reports a yellow turn that was never retried', () => {
    expect(records[2]).toMatchObject({
      check: 'guard-retry',
      retriedOnce: false,
      passedOnRetry: false,
    });
  });

  it('never reports a negative history', () => {
    const lone = run({
      models: [
        model({
          scenarios: [
            {
              scenarioId: 'base-chat',
              title: 'Base chat',
              verdict: 'warn',
              turns: [
                turn(0, {
                  verdict: 'warn',
                  attempts: [
                    attempt({ promptMessages: 0, findings: [retryFinding] }),
                  ],
                }),
              ],
            },
          ],
        }),
      ],
    });
    expect(failedTurnRecords(lone)[0]?.prompt.historyTurns).toBe(0);
  });

  it('says what went wrong in one sentence', () => {
    expect(failedTurnSentence(records[1]!)).toBe(
      'Qwen 3 0.6B · Base chat turn 3: loop, expected no line or sentence repeated 3 times, got "sleep early" ×3 (passed on retry).'
    );
    expect(failedTurnSentence(records[0]!)).not.toContain('retry');
  });
});

describe('modelIssues', () => {
  it('lists skipped models as yellow and models that did not load as red', () => {
    const issues = modelIssues(
      run({
        models: [
          model({ modelName: 'A', skippedReason: 'not enough free space' }),
          model({ modelName: 'B', loadError: 'out of memory' }),
          model({ modelName: 'C' }),
        ],
      })
    );
    expect(issues).toEqual([
      {
        model: 'A',
        severity: 'warn',
        summary: 'not tested: not enough free space',
      },
      { model: 'B', severity: 'fail', summary: 'did not load: out of memory' },
    ]);
  });
});

describe('compareWithPreviousRuns', () => {
  const previous = run({
    startedAt: '2026-10-01T10:00:00.000Z',
  });

  it('flags every metric past its threshold, turn by turn', () => {
    const slower = run({
      models: [
        model({
          loadMs: 2700,
          speed: { tokPerS: 23, ttftMs: 300, peakMemoryBytes: 1.2 * 1024 ** 3 },
          scenarios: [
            {
              scenarioId: 'base-chat',
              title: 'Base chat',
              verdict: 'pass',
              turns: [
                turn(0, {
                  attempts: [
                    attempt({
                      timings: { ttftMs: 700, tokPerS: 15, turnMs: 14_000 },
                    }),
                  ],
                }),
                turn(1),
              ],
            },
          ],
        }),
      ],
    });

    const regressions = compareWithPreviousRuns(slower, [previous]);

    expect(regressions.map((item) => `${item.where}/${item.metric}`)).toEqual([
      'load/loadMs',
      'speed test/tokPerS',
      'speed test/ttftMs',
      'speed test/peakMemoryBytes',
      'Base chat turn 1/ttftMs',
      'Base chat turn 1/tokPerS',
      'Base chat turn 1/turnMs',
    ]);
  });

  it('stays quiet within the thresholds', () => {
    const similar = run({
      models: [
        model({
          loadMs: 2500,
          speed: { tokPerS: 25, ttftMs: 250, peakMemoryBytes: 1.1 * 1024 ** 3 },
        }),
      ],
    });
    expect(compareWithPreviousRuns(similar, [previous])).toEqual([]);
  });

  it('compares with the latest earlier run of the same device and model', () => {
    const older = run({
      startedAt: '2026-09-01T10:00:00.000Z',
      models: [model({ loadMs: 100 })],
    });
    const otherDevice = run({
      startedAt: '2026-10-01T12:00:00.000Z',
      device: { ...previous.device, id: 'device-b' },
      models: [model({ loadMs: 100 })],
    });
    const later = run({
      startedAt: '2026-10-03T10:00:00.000Z',
      models: [model({ loadMs: 100 })],
    });
    const skipped = run({
      startedAt: '2026-10-01T18:00:00.000Z',
      models: [model({ loadMs: undefined, skippedReason: 'offline' })],
    });

    expect(
      compareWithPreviousRuns(run(), [
        older,
        otherDevice,
        later,
        skipped,
        previous,
      ])
    ).toEqual([]);
  });

  it('has nothing to compare for a model without history or one not loaded', () => {
    const fresh = run({
      models: [
        model({ modelName: 'New model' }),
        model({ loadMs: undefined, loadError: 'boom' }),
      ],
    });
    expect(compareWithPreviousRuns(fresh, [previous])).toEqual([]);
  });

  it('skips missing readings and scenarios the previous run did not have', () => {
    const partial = run({
      models: [
        model({
          speed: null,
          scenarios: [
            {
              scenarioId: 'base-chat',
              title: 'Base chat',
              verdict: 'fail',
              turns: [
                turn(0, {
                  attempts: [
                    attempt({
                      timings: { ttftMs: null, tokPerS: null, turnMs: 9000 },
                    }),
                  ],
                }),
                turn(1, { attempts: [] }),
                turn(7),
              ],
            },
            {
              scenarioId: 'document',
              title: 'Document',
              verdict: 'pass',
              turns: [turn(0)],
            },
          ],
        }),
      ],
    });
    expect(compareWithPreviousRuns(partial, [previous])).toEqual([]);
  });

  it('writes each regression as one sentence', () => {
    expect(
      regressionSentence({
        model: 'Qwen 3 0.6B',
        where: 'speed test',
        metric: 'tokPerS',
        previous: 30,
        current: 21,
        change: -0.3,
      })
    ).toBe(
      'Qwen 3 0.6B · speed test: tokens per second 30.0 tok/s → 21.0 tok/s (-30 %).'
    );
    expect(
      regressionSentence({
        model: 'Qwen 3 0.6B',
        where: 'load',
        metric: 'loadMs',
        previous: 2000,
        current: 2700,
        change: 0.35,
      })
    ).toBe('Qwen 3 0.6B · load: load time 2000 ms → 2700 ms (+35 %).');
    expect(
      regressionSentence({
        model: 'Qwen 3 0.6B',
        where: 'speed test',
        metric: 'peakMemoryBytes',
        previous: 1024 ** 3,
        current: 1.5 * 1024 ** 3,
        change: 0.5,
      })
    ).toContain('1.00 GB → 1.50 GB');
  });
});

describe('copyForAiMarkdown', () => {
  it('holds the summary, the model problems, full failed turns and the regressions', () => {
    const failing = runWithFailures();
    failing.models.push(
      model({
        modelName: 'Big model',
        verdict: 'warn',
        loadMs: undefined,
        speed: undefined,
        skippedReason: 'not enough free space',
        scenarios: [],
      })
    );
    const markdown = copyForAiMarkdown(failing, [
      {
        model: 'Qwen 3 0.6B',
        where: 'load',
        metric: 'loadMs',
        previous: 2000,
        current: 2700,
        change: 0.35,
      },
    ]);

    expect(markdown).toContain('# Private Mind dev benchmark — 1.3.1 (42)');
    expect(markdown).toContain(
      '| Qwen 3 0.6B | red | 2.0 s | 30.0 | red 1/5 |'
    );
    expect(markdown).toContain('| Big model | yellow | – | – | – |');
    expect(markdown).toContain(
      '- Big model (yellow): not tested: not enough free space'
    );
    expect(markdown).toContain('## Failed turns (3)');
    expect(markdown).toContain('"raw": "Sleep early. Sleep early.');
    expect(markdown).not.toContain('question 1"');
    expect(markdown).toContain('## Slower than the previous run');
  });

  it('leaves out the empty sections and says when a run did not finish', () => {
    const markdown = copyForAiMarkdown(run({ finishedAt: undefined }), []);
    expect(markdown).toContain('not finished');
    expect(markdown).toContain('## Failed turns (0)');
    expect(markdown).not.toContain('## Models not tested');
    expect(markdown).not.toContain('## Slower');
  });
});

describe('passedTurnCount', () => {
  it('counts the green turns of a scenario', () => {
    expect(passedTurnCount(runWithFailures().models[0]!.scenarios[0]!)).toBe(1);
  });
});

describe('saved runs', () => {
  beforeEach(() => writtenFiles.clear());

  it('names the file after the start time and the build', () => {
    expect(reportFileName(run())).toBe('2026-10-02T10-00-00-000Z-42.json');
  });

  it('writes the run and reads it back for the next comparison', async () => {
    const path = await saveRunReport(run());

    expect(path).toBe(
      '/sdcard/Android/data/app/files/dev-benchmark/2026-10-02T10-00-00-000Z-42.json'
    );
    expect(await loadSavedRuns()).toEqual([run()]);
  });

  it('skips files that are not runs', async () => {
    await saveRunReport(run());
    writtenFiles.set(
      '/sdcard/Android/data/app/files/dev-benchmark/broken.json',
      '{'
    );
    writtenFiles.set(
      '/sdcard/Android/data/app/files/dev-benchmark/other.json',
      '{"hello":1}'
    );
    writtenFiles.set(
      '/sdcard/Android/data/app/files/dev-benchmark/notes.txt',
      'x'
    );

    expect(await loadSavedRuns()).toHaveLength(1);
  });

  it('returns no runs when the directory cannot be read', async () => {
    readDir.mockRejectedValueOnce(new Error('ENOENT'));

    expect(await loadSavedRuns()).toEqual([]);
  });
});
