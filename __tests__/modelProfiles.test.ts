import { DEFAULT_MODELS } from '../constants/default-models';
import {
  DEFAULT_PROFILE,
  PLANNER_EVIDENCE,
  PROFILE_BY_FAMILY,
  PROFILE_BY_MODEL,
  WEB_ANSWER_EVIDENCE,
  WEB_PLANNER_MATRIX,
  WEB_SEARCH_MIN_PARAMETERS_B,
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

  it('never assigns "llm" to a model whose own evidence recorded verbatim outperforming it (F13)', () => {
    for (const [name, evidence] of Object.entries(PLANNER_EVIDENCE)) {
      if (
        /verbatim on the (rest|other \d+):\s*100% retrieval/i.test(evidence)
      ) {
        expect([name, WEB_PLANNER_MATRIX[name]]).toEqual([name, 'verbatim']);
      }
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

  it('keeps web search off the models that fabricated their way through the cross-model pass', () => {
    expect(isWebSearchReady({ modelName: 'LFM 2.5 VL - 450M' })).toBe(false);
    expect(isWebSearchReady({ modelName: 'Qwen 2.5 - 1.5B' })).toBe(false);
    expect(isWebSearchReady({ modelName: 'Qwen 2.5 - 3B' })).toBe(false);
  });

  it('leaves the models that only need more memory available', () => {
    expect(isWebSearchReady({ modelName: 'Gemma 4 - 2B' })).toBe(true);
    expect(isWebSearchReady({ modelName: 'LFM 2.5 - 1.2B' })).toBe(true);
    expect(isWebSearchReady({ modelName: 'Qwen 3 - 0.6B' })).toBe(true);
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

describe('web search capability floor', () => {
  it('turns web search off for an uncatalogued model below the floor', () => {
    expect(
      isWebSearchReady({ modelName: 'Tiny Import - 300M', parameters: 0.3 })
    ).toBe(false);
  });

  it('leaves an uncatalogued model at the floor enabled', () => {
    expect(
      isWebSearchReady({
        modelName: 'Small Import - 700M',
        parameters: WEB_SEARCH_MIN_PARAMETERS_B,
      })
    ).toBe(true);
  });

  it('leaves a model of unknown size enabled, having no evidence either way', () => {
    expect(isWebSearchReady({ modelName: 'Unlabelled Import' })).toBe(true);
  });

  it('admits the smallest catalogued model the corpus scored as usable', () => {
    const qwen3 = DEFAULT_MODELS.find(
      (model) => model.modelName === 'Qwen 3 - 0.6B'
    );
    expect(qwen3?.parameters).toBeGreaterThanOrEqual(
      WEB_SEARCH_MIN_PARAMETERS_B
    );
    expect(isWebSearchReady(qwen3!)).toBe(true);
  });

  it('leaves every catalogued verdict exactly where its evidence put it', () => {
    const gated = DEFAULT_MODELS.filter((model) => !isWebSearchReady(model))
      .map((model) => model.modelName)
      .sort();
    expect(gated).toEqual(
      [
        'LFM 2.5 VL - 450M',
        'Qwen 2.5 - 0.5B',
        'Qwen 2.5 - 1.5B',
        'Qwen 2.5 - 3B',
      ].sort()
    );
  });

  it('never gates a catalogued model without recording why', () => {
    for (const model of DEFAULT_MODELS) {
      if (isWebSearchReady(model)) continue;
      expect(
        WEB_ANSWER_EVIDENCE[model.modelName] ??
          PLANNER_EVIDENCE[model.modelName]
      ).toBeDefined();
    }
  });
});
