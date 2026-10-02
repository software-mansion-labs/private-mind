import {
  BASE_CHAT_SCENARIO,
  DEV_BENCHMARK_SCENARIOS,
} from '../utils/devBenchmark/scenarios';
import { detectQuestionLanguage } from '../utils/questionLanguage';

describe('base chat scenario', () => {
  it('walks greeting, English, Polish follow-up, Hindi list, table, Urdu', () => {
    expect(BASE_CHAT_SCENARIO.turns.map((turn) => turn.language)).toEqual([
      'pl',
      'en',
      'pl',
      'hi',
      'en',
      'ur',
    ]);
  });

  it.each(BASE_CHAT_SCENARIO.turns.map((turn) => [turn.prompt, turn.language]))(
    'is read by the app as the language it is meant to test: %s',
    (prompt, language) => {
      expect(detectQuestionLanguage(prompt)?.code).toBe(language);
    }
  );

  it('opens with a greeting and asks for seven items and a table', () => {
    const [greeting, , , list, table] = BASE_CHAT_SCENARIO.turns;
    expect(greeting?.greeting).toBe(true);
    expect(list?.expectListItems).toBe(7);
    expect(table?.expectTable).toBe(true);
  });

  it('is part of the benchmark under a unique id', () => {
    const ids = DEV_BENCHMARK_SCENARIOS.map((scenario) => scenario.id);
    expect(ids).toContain(BASE_CHAT_SCENARIO.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
