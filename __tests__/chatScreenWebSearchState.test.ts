import { renderHook } from '@testing-library/react-native';

const mockToast = jest.fn();
jest.mock('react-native-toast-message', () => ({
  show: (...args: unknown[]) => mockToast(...args),
}));
jest.mock('../store/chatStore', () => ({
  useChatStore: () => ({
    phantomChat: null,
    setPhantomChatSettings: jest.fn(),
  }),
}));
jest.mock('../store/llmStore', () => ({
  useLLMStore: () => ({ model: null, loadModel: jest.fn() }),
}));
jest.mock('../store/modelStore', () => ({
  useModelStore: () => ({ getModelById: jest.fn() }),
}));
jest.mock('../database/chatRepository', () => ({
  checkIfChatExists: jest.fn(),
  setChatSettings: jest.fn(),
}));
jest.mock('../utils/modelCompatibility', () => ({
  hasMemoryForWebSearch: () => true,
}));

import { useChatScreenActions } from '../components/chat-screen/useChatScreenActions';
import type { Model } from '../database/modelRepository';

const modelNamed = (modelName: string, parameters: number): Model =>
  ({
    id: 1,
    modelName,
    parameters,
    source: 'built-in',
    isDownloaded: true,
    modelPath: '',
    tokenizerPath: '',
    tokenizerConfigPath: '',
  }) as Model;

const setSetting = jest.fn();

const actionsFor = (model: Model, webSearchEnabled: boolean) =>
  renderHook(() =>
    useChatScreenActions({
      chatId: 1,
      chat: undefined,
      model,
      chatSettings: {
        systemPrompt: '',
        thinkingEnabled: false,
        webSearchEnabled,
      },
      setSetting,
      db: {} as never,
      inputRef: { current: null },
    })
  ).result.current;

describe('web search state follows the model that has to run it', () => {
  beforeEach(() => {
    setSetting.mockClear();
    mockToast.mockClear();
  });

  it('reads as off once the chat moves to a model that cannot search', () => {
    const actions = actionsFor(modelNamed('Qwen 2.5 - 0.5B', 0.49), true);
    expect(actions.webSearchEnabled).toBe(false);
  });

  it('reads as on for a model that can', () => {
    const actions = actionsFor(modelNamed('Qwen 3 - 1.7B', 2.03), true);
    expect(actions.webSearchEnabled).toBe(true);
  });

  it('explains itself instead of silently clearing the setting', () => {
    const actions = actionsFor(modelNamed('Qwen 2.5 - 0.5B', 0.49), true);

    expect(actions.handleWebSearchToggle()).toBe(false);
    expect(setSetting).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalled();
  });

  it('keeps the setting, so going back to a capable model restores it', () => {
    const gated = actionsFor(modelNamed('Qwen 2.5 - 0.5B', 0.49), true);
    gated.handleWebSearchToggle();

    const capable = actionsFor(modelNamed('Qwen 3 - 1.7B', 2.03), true);
    expect(capable.webSearchEnabled).toBe(true);
  });

  it('still turns off on demand for a model that can search', () => {
    const actions = actionsFor(modelNamed('Qwen 3 - 1.7B', 2.03), true);

    expect(actions.handleWebSearchToggle()).toBe(true);
    expect(setSetting).toHaveBeenCalledWith('webSearchEnabled', false);
  });
});
