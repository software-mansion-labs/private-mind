type NativeLLM = {
  setStallWatch: jest.Mock;
  lastGenerationStalled: jest.Mock;
  unload: jest.Mock;
};

type PatchedController = {
  configure: (config: {
    generationConfig?: { stallPassMs?: number; stallPassCount?: number };
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
  it('hands the stall threshold to the native runner with two passes by default', () => {
    const native = nativeLLM();
    controllerOver(native).configure({
      generationConfig: { stallPassMs: 2000 },
    });
    expect(native.setStallWatch).toHaveBeenCalledWith(2000, 2);
  });

  it('passes an explicit pass count through', () => {
    const native = nativeLLM();
    controllerOver(native).configure({
      generationConfig: { stallPassMs: 1500, stallPassCount: 3 },
    });
    expect(native.setStallWatch).toHaveBeenCalledWith(1500, 3);
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
