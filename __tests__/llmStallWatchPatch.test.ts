type NativeLLM = {
  setStallWatch: jest.Mock;
  lastGenerationStalled: jest.Mock;
  unload: jest.Mock;
};

type PatchedController = {
  configure: (config: {
    generationConfig?: {
      stallPassMs?: number;
      stallPassCount?: number;
      stallPrefillPassMs?: number;
      stallPrefillPassCount?: number;
    };
  }) => void;
  lastGenerationStalled: () => boolean;
  nativeModule?: NativeLLM;
};

const { LLMController } = jest.requireActual(
  '../node_modules/react-native-executorch/lib/module/legacy/src/controllers/LLMController'
) as {
  LLMController: new (callbacks: object) => PatchedController;
};

const controllerOver = (native?: NativeLLM): PatchedController => {
  const controller = new LLMController({});
  controller.nativeModule = native;
  return controller;
};

const nativeLLM = (stalled = false): NativeLLM => ({
  setStallWatch: jest.fn(),
  lastGenerationStalled: jest.fn(() => stalled),
  unload: jest.fn(),
});

describe('react-native-executorch stall watch patch', () => {
  it('hands the decode and prefill thresholds to the native runner with two passes by default', () => {
    const native = nativeLLM();
    controllerOver(native).configure({
      generationConfig: { stallPassMs: 3000, stallPrefillPassMs: 750 },
    });
    expect(native.setStallWatch).toHaveBeenCalledWith(3000, 2, 750, 2);
  });

  it('counts slow prefill chunks against their own pass count', () => {
    const native = nativeLLM();
    controllerOver(native).configure({
      generationConfig: {
        stallPassMs: 3000,
        stallPassCount: 2,
        stallPrefillPassMs: 750,
        stallPrefillPassCount: 3,
      },
    });
    expect(native.setStallWatch).toHaveBeenCalledWith(3000, 2, 750, 3);
  });

  it('leaves the prefill watch off unless it is asked for', () => {
    const native = nativeLLM();
    controllerOver(native).configure({
      generationConfig: { stallPassMs: 2000 },
    });
    expect(native.setStallWatch).toHaveBeenCalledWith(2000, 2, 0, 2);
  });

  it('leaves the decode watch off when only the prefill threshold is set', () => {
    const native = nativeLLM();
    controllerOver(native).configure({
      generationConfig: { stallPrefillPassMs: 500 },
    });
    expect(native.setStallWatch).toHaveBeenCalledWith(0, 2, 500, 2);
  });

  it('passes an explicit pass count through', () => {
    const native = nativeLLM();
    controllerOver(native).configure({
      generationConfig: { stallPassMs: 1500, stallPassCount: 3 },
    });
    expect(native.setStallWatch).toHaveBeenCalledWith(1500, 3, 0, 2);
  });

  it('leaves the stall watch alone when the config does not set it', () => {
    const native = nativeLLM();
    controllerOver(native).configure({ generationConfig: {} });
    expect(native.setStallWatch).not.toHaveBeenCalled();
  });

  it('rejects a negative threshold or a pass count below one', () => {
    const native = nativeLLM();
    const controller = controllerOver(native);
    expect(() =>
      controller.configure({ generationConfig: { stallPassMs: -1 } })
    ).toThrow();
    expect(() =>
      controller.configure({ generationConfig: { stallPrefillPassMs: -1 } })
    ).toThrow();
    expect(() =>
      controller.configure({
        generationConfig: { stallPrefillPassMs: 750, stallPrefillPassCount: 0 },
      })
    ).toThrow();
    expect(() =>
      controller.configure({
        generationConfig: { stallPassMs: 2000, stallPassCount: 0 },
      })
    ).toThrow();
    expect(native.setStallWatch).not.toHaveBeenCalled();
  });

  it('reports whether the last generation stalled', () => {
    expect(controllerOver(nativeLLM(true)).lastGenerationStalled()).toBe(true);
    expect(controllerOver(nativeLLM(false)).lastGenerationStalled()).toBe(
      false
    );
  });

  it('reports no stall once the native module is gone', () => {
    expect(controllerOver(undefined).lastGenerationStalled()).toBe(false);
  });
});
