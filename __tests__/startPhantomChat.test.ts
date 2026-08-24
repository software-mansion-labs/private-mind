import { router } from 'expo-router';
import { startPhantomChat } from '../utils/startPhantomChat';
import { useChatStore } from '../store/chatStore';
import { useLLMStore } from '../store/llmStore';
import { useModelStore } from '../store/modelStore';
import { getNextChatId } from '../database/chatRepository';
import { getLastUsedModelId } from '../utils/lastUsedModel';
import type { Model } from '../database/modelRepository';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

jest.mock('../database/chatRepository', () => ({
  getNextChatId: jest.fn(),
}));

jest.mock('../utils/lastUsedModel', () => ({
  getLastUsedModelId: jest.fn(),
  setLastUsedModelId: jest.fn(),
}));

jest.mock('../store/chatStore', () => ({
  useChatStore: { getState: jest.fn() },
}));

jest.mock('../store/llmStore', () => ({
  useLLMStore: { getState: jest.fn() },
}));

jest.mock('../store/modelStore', () => ({
  useModelStore: { getState: jest.fn() },
}));

const model: Model = { id: 7 } as Model;

describe('startPhantomChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (useModelStore.getState as jest.Mock).mockReturnValue({
      downloadedModels: [model],
    });
    (getNextChatId as jest.Mock).mockResolvedValue(42);
    (getLastUsedModelId as jest.Mock).mockResolvedValue(7);
    (useChatStore.getState as jest.Mock).mockReturnValue({
      initPhantomChat: jest.fn().mockResolvedValue(undefined),
    });
    (useLLMStore.getState as jest.Mock).mockReturnValue({
      setActiveChatId: jest.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('replaces without waiting on a timer', async () => {
    await startPhantomChat({} as never, 'replace');

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/chat/42',
      params: { modelId: '7' },
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears the active chat before navigating', async () => {
    const setActiveChatId = jest.fn().mockResolvedValue(undefined);
    (useLLMStore.getState as jest.Mock).mockReturnValue({ setActiveChatId });

    await startPhantomChat({} as never, 'replace');

    expect(setActiveChatId).toHaveBeenCalledWith(null);
    expect(setActiveChatId.mock.invocationCallOrder[0]).toBeLessThan(
      (router.replace as jest.Mock).mock.invocationCallOrder[0]
    );
  });

  it('does not delay a push navigation', async () => {
    await startPhantomChat({} as never, 'push');

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chat/42',
      params: { modelId: '7' },
    });
    expect(router.replace).not.toHaveBeenCalled();
  });
});
