const gemmaVl = {
  modelName: 'Gemma 4 VL - 2B',
  family: 'Gemma 4',
  parameters: 2,
};

const ESTIMATOR_UNDERCOUNT_ALLOWANCE = 1.25;

const loadFor = (os: 'android' | 'ios') => {
  let profiles!: typeof import('../constants/model-profiles');
  let contextWindow!: typeof import('../constants/context-window');

  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({ Platform: { OS: os } }));
    profiles = require('../constants/model-profiles');
    contextWindow = require('../constants/context-window');
  });

  return { profiles, contextWindow };
};

afterEach(() => {
  jest.dontMock('react-native');
});

describe('Gemma 4 VL on Android', () => {
  it('takes its context window from what the export will accept', () => {
    const { profiles } = loadFor('android');

    expect(profiles.getModelProfile(gemmaVl).contextWindowTokens).toBe(
      profiles.GEMMA4_VL_ANDROID_EXPORT_CAPACITY_TOKENS
    );
  });

  it('keeps the prompt budget under that capacity even if the estimate runs low', () => {
    const { profiles, contextWindow } = loadFor('android');

    const budget = contextWindow.getPromptTokenBudget(gemmaVl as never);

    expect(budget * ESTIMATOR_UNDERCOUNT_ALLOWANCE).toBeLessThan(
      profiles.GEMMA4_VL_ANDROID_EXPORT_CAPACITY_TOKENS
    );
  });

  it('leaves iOS on the default window, where a different export is used', () => {
    const { profiles } = loadFor('ios');

    expect(profiles.getModelProfile(gemmaVl).contextWindowTokens).toBe(
      profiles.DEFAULT_PROFILE.contextWindowTokens
    );
  });
});
