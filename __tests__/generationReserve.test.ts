import {
  DEFAULT_PROFILE,
  GENERATION_RESERVE_EVIDENCE,
  GENERATION_RESERVE_MIN_TOKENS,
  getModelProfile,
  scaledGenerationReserve,
  WEB_ANSWER_EVIDENCE,
  WEB_PLANNER_MATRIX,
} from '../constants/model-profiles';
import { getPromptTokenBudget } from '../constants/context-window';
import type { Model } from '../database/modelRepository';

const makeModel = (modelName: string): Model =>
  ({
    id: 1,
    modelName,
    source: 'remote',
    isDownloaded: true,
    modelPath: 'm',
    tokenizerPath: 't',
    tokenizerConfigPath: 'tc',
    thinking: false,
  }) as Model;

describe('scaledGenerationReserve', () => {
  it('scales with the window instead of being one measured constant', () => {
    expect(scaledGenerationReserve(2048)).toBe(512);
    expect(scaledGenerationReserve(4096)).toBe(1024);
    expect(scaledGenerationReserve(8192)).toBe(2048);
  });

  it('never leaves less than a usable answer for a tiny window', () => {
    expect(scaledGenerationReserve(512)).toBe(GENERATION_RESERVE_MIN_TOKENS);
    expect(scaledGenerationReserve(0)).toBe(GENERATION_RESERVE_MIN_TOKENS);
  });

  it('agrees with the default profile at the default window', () => {
    expect(DEFAULT_PROFILE.generationReserveTokens).toBe(
      scaledGenerationReserve(DEFAULT_PROFILE.contextWindowTokens)
    );
  });
});

describe('every shipped model gets a reserve, measured or scaled', () => {
  const shipped = [
    ...new Set([
      ...Object.keys(WEB_PLANNER_MATRIX),
      ...Object.keys(WEB_ANSWER_EVIDENCE),
    ]),
  ];

  it.each(shipped)('leaves a positive prompt budget for %s', (modelName) => {
    const profile = getModelProfile(makeModel(modelName));
    expect(profile.generationReserveTokens).toBeGreaterThanOrEqual(
      GENERATION_RESERVE_MIN_TOKENS
    );
    expect(profile.generationReserveTokens).toBeLessThan(
      profile.contextWindowTokens
    );
    expect(getPromptTokenBudget(makeModel(modelName))).toBeGreaterThan(0);
  });

  it('scales the reserve to whatever window a model is given', () => {
    const profile = getModelProfile(makeModel('Qwen 3 - 0.6B'));
    expect(profile.generationReserveTokens).toBe(
      scaledGenerationReserve(profile.contextWindowTokens)
    );
  });
});

describe('the reserve measurement is attributed, not presented as universal', () => {
  it('records which model the number came from', () => {
    expect(Object.keys(GENERATION_RESERVE_EVIDENCE)).toEqual(['Qwen 3 - 1.7B']);
    expect(GENERATION_RESERVE_EVIDENCE['Qwen 3 - 1.7B']).toContain(
      'UNCONFIRMED'
    );
  });
});
