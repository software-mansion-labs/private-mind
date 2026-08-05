import { DEFAULT_MODELS } from '../constants/default-models';
import {
  DEFAULT_PROFILE,
  PLANNER_EVIDENCE,
  PROFILE_BY_FAMILY,
  PROFILE_BY_MODEL,
  WEB_ANSWER_EVIDENCE,
  WEB_PLANNER_MATRIX,
  getModelProfile,
  getWebSearchMinDeviceMemoryGB,
  isWebSearchReady,
  usesLlmPlanner,
} from '../constants/model-profiles';

describe('WEB_PLANNER_MATRIX', () => {
  it('covers every catalogued model, so no model silently rides the default', () => {
    for (const model of DEFAULT_MODELS) {
      expect(WEB_PLANNER_MATRIX[model.modelName]).toBeDefined();
    }
  });

  it('names a real model in every matrix and evidence entry', () => {
    const known = new Set(DEFAULT_MODELS.map((model) => model.modelName));
    for (const name of Object.keys(WEB_PLANNER_MATRIX)) {
      expect(known.has(name)).toBe(true);
    }
    for (const name of Object.keys(PLANNER_EVIDENCE)) {
      expect(known.has(name)).toBe(true);
    }
    for (const name of Object.keys(WEB_ANSWER_EVIDENCE)) {
      expect(known.has(name)).toBe(true);
    }
  });
});

describe('isWebSearchReady', () => {
  it('defaults to ready, including for unknown models', () => {
    expect(isWebSearchReady({ modelName: 'Something New - 8B' })).toBe(true);
    expect(isWebSearchReady(null)).toBe(true);
  });

  it('marks the model measured unable to use retrieved context as not ready', () => {
    expect(isWebSearchReady({ modelName: 'Qwen 2.5 - 0.5B' })).toBe(false);
    expect(WEB_ANSWER_EVIDENCE['Qwen 2.5 - 0.5B']).toBeDefined();
  });

  it('backs every not-ready verdict with recorded evidence', () => {
    for (const [name, profile] of Object.entries(PROFILE_BY_MODEL)) {
      if (profile.webSearchReady === false) {
        expect([name, WEB_ANSWER_EVIDENCE[name]]).toEqual([
          name,
          expect.any(String),
        ]);
      }
    }
  });
});

describe('getModelProfile', () => {
  it('falls back to the default profile for an unknown model', () => {
    expect(
      getModelProfile({ modelName: 'Something New - 8B', family: 'Something' })
    ).toEqual(DEFAULT_PROFILE);
    expect(getModelProfile(null)).toEqual(DEFAULT_PROFILE);
  });

  it('applies the matrix planner mode', () => {
    expect(
      getModelProfile({ modelName: 'LFM 2.5 VL - 450M', family: 'LFM 2.5' })
        .webPlanner
    ).toBe(WEB_PLANNER_MATRIX['LFM 2.5 VL - 450M']);
  });

  it('resolves modelName over family over default', () => {
    PROFILE_BY_FAMILY['Test Family'] = { webRetrievalTopK: 3 };
    PROFILE_BY_MODEL['Test Family - A'] = { webRetrievalTopK: 1 };
    try {
      expect(
        getModelProfile({ modelName: 'Test Family - B', family: 'Test Family' })
          .webRetrievalTopK
      ).toBe(3);
      expect(
        getModelProfile({ modelName: 'Test Family - A', family: 'Test Family' })
          .webRetrievalTopK
      ).toBe(1);
    } finally {
      delete PROFILE_BY_FAMILY['Test Family'];
      delete PROFILE_BY_MODEL['Test Family - A'];
    }
  });

  it('derives the family from the model name when the row has none', () => {
    PROFILE_BY_FAMILY['Qwen 3'] = { webRetrievalTopK: 2 };
    try {
      expect(
        getModelProfile({ modelName: 'Qwen 3 - 1.7B' }).webRetrievalTopK
      ).toBe(2);
    } finally {
      delete PROFILE_BY_FAMILY['Qwen 3'];
    }
  });
});

describe('usesLlmPlanner', () => {
  it('follows the matrix', () => {
    for (const model of DEFAULT_MODELS) {
      expect([model.modelName, usesLlmPlanner(model)]).toEqual([
        model.modelName,
        WEB_PLANNER_MATRIX[model.modelName] === 'llm',
      ]);
    }
  });

  it('is false for a model the matrix does not list', () => {
    expect(usesLlmPlanner({ modelName: 'Something New - 8B' })).toBe(false);
  });
});

describe('web search memory requirement', () => {
  it('names a device memory floor only for models measured to need one', () => {
    expect(
      getWebSearchMinDeviceMemoryGB({
        modelName: 'Gemma 4 - 2B',
        family: 'Gemma 4',
      })
    ).toBe(8);
    expect(
      getWebSearchMinDeviceMemoryGB({
        modelName: 'Qwen 3 - 0.6B',
        family: 'Qwen 3',
      })
    ).toBeUndefined();
  });

  it('keeps every memory-gated model inside the catalogue', () => {
    const catalogue = new Set(DEFAULT_MODELS.map((model) => model.modelName));
    for (const [name, profile] of Object.entries(PROFILE_BY_MODEL)) {
      if (profile.webSearchMinDeviceMemoryGB === undefined) continue;
      expect(catalogue.has(name)).toBe(true);
    }
  });
});
