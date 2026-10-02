import React from 'react';
import { ScrollView } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { IssueList } from '../components/devBenchmark/IssueList';
import { ResultsTable } from '../components/devBenchmark/ResultsTable';
import { TurnDetailModal } from '../components/devBenchmark/TurnDetailModal';
import { failedTurns, modelIssues } from '../utils/devBenchmark/report';
import type { BenchmarkRun } from '../utils/devBenchmark/types';

const run: BenchmarkRun = {
  startedAt: '2026-10-02T10:00:00.000Z',
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
  models: [
    {
      modelId: 1,
      modelName: 'Qwen 3 0.6B',
      modelSizeGB: 0.6,
      verdict: 'fail',
      loadMs: 2100,
      speed: { tokPerS: 31.4, ttftMs: 200, peakMemoryBytes: 1 },
      scenarios: [
        {
          scenarioId: 'base-chat',
          title: 'Base chat',
          verdict: 'fail',
          turns: [
            {
              index: 0,
              prompt: 'cześć',
              verdict: 'fail',
              attempts: [
                {
                  raw: 'Hello there and',
                  tidied: 'Hello there and',
                  final: 'Hello there and',
                  retries: [],
                  generationError: null,
                  timings: { ttftMs: 300, tokPerS: 20, turnMs: 4000 },
                  systemChars: 900,
                  promptMessages: 2,
                  findings: [
                    {
                      check: 'cut-off',
                      severity: 'fail',
                      expected: 'a finished answer',
                      actual: 'ends mid-sentence',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      modelId: 2,
      modelName: 'Big model',
      modelSizeGB: 8,
      verdict: 'warn',
      skippedReason: 'needs 9.8 GB free, 2.0 GB left',
      scenarios: [],
    },
  ],
};

describe('dev benchmark results', () => {
  it('shows each model with its load, speed and a row per scenario under it', () => {
    render(<ResultsTable run={run} scenarioTitles={['Base chat']} />);

    expect(screen.getAllByText('Base chat')).toHaveLength(2);
    expect(screen.UNSAFE_queryByType(ScrollView)).toBeNull();

    expect(screen.getByText('Qwen 3 0.6B')).toBeTruthy();
    expect(screen.getByText('2.1 s')).toBeTruthy();
    expect(screen.getByText('31.4')).toBeTruthy();
    expect(screen.getByText('0/1')).toBeTruthy();
    expect(screen.getAllByText('–')).toHaveLength(3);
  });

  it('lists red and yellow results in one sentence each and opens a turn', () => {
    const onOpenTurn = jest.fn();
    const turns = failedTurns(run);
    render(
      <IssueList
        modelIssues={modelIssues(run)}
        failedTurns={turns}
        regressions={[
          {
            model: 'Qwen 3 0.6B',
            where: 'load',
            metric: 'loadMs',
            previous: 1000,
            current: 2100,
            change: 1.1,
          },
        ]}
        onOpenTurn={onOpenTurn}
      />
    );

    expect(
      screen.getByText('Big model: not tested: needs 9.8 GB free, 2.0 GB left.')
    ).toBeTruthy();
    expect(screen.getByText(/load time 1000 ms → 2100 ms/)).toBeTruthy();
    fireEvent.press(screen.getByText(/Base chat turn 1: cut-off/));

    expect(onOpenTurn).toHaveBeenCalledWith(turns[0]);
  });

  it('says so when nothing is red or yellow', () => {
    render(
      <IssueList
        modelIssues={[]}
        failedTurns={[]}
        regressions={[]}
        onOpenTurn={jest.fn()}
      />
    );

    expect(screen.getByText('Nothing red or yellow.')).toBeTruthy();
  });

  it('shows the whole turn with its answer and findings', () => {
    const onClose = jest.fn();
    render(
      <TurnDetailModal failedTurn={failedTurns(run)[0]!} onClose={onClose} />
    );

    expect(screen.getByText('Qwen 3 0.6B · Base chat turn 1')).toBeTruthy();
    expect(screen.getByText('cześć')).toBeTruthy();
    expect(screen.getByText('Hello there and')).toBeTruthy();
    expect(
      screen.getByText(
        'cut-off: expected a finished answer, got ends mid-sentence'
      )
    ).toBeTruthy();
    fireEvent.press(screen.getByText('Close'));

    expect(onClose).toHaveBeenCalled();
  });
});
