import type { Model } from '../database/modelRepository';
import {
  loadModelPinnedToChat,
  retryWithPinnedModel,
} from '../components/chat-screen/loadModelPinnedToChat';
import { useLLMStore } from '../store/llmStore';

const loadModel = jest.fn(async () => {});
const state = { model: null as Model | null, loadModel };

jest.mock('../store/llmStore', () => ({
  useLLMStore: { getState: jest.fn() },
}));

const gemma = { id: 2, modelName: 'Gemma 4 - 2B' } as Model;
const qwen = { id: 1, modelName: 'Qwen 3 - 1.7B' } as Model;

beforeEach(() => {
  loadModel.mockClear();
  state.model = qwen;
  (useLLMStore.getState as jest.Mock).mockReturnValue(state);
});

describe('loadModelPinnedToChat', () => {
  it('loads the chat’s own model when another one is resident', () => {
    loadModelPinnedToChat(gemma);

    expect(loadModel).toHaveBeenCalledWith(gemma);
  });

  it('leaves the model alone when it is already the resident one', () => {
    loadModelPinnedToChat(qwen);

    expect(loadModel).not.toHaveBeenCalled();
  });

  it('does nothing for a chat with no model of its own', () => {
    loadModelPinnedToChat(undefined);

    expect(loadModel).not.toHaveBeenCalled();
  });

  it('reports a failed load instead of rejecting into nothing', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    loadModel.mockRejectedValueOnce(new Error('no such file'));

    loadModelPinnedToChat(gemma);
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('retryWithPinnedModel', () => {
  it('queues the chat’s model before the retry reads which one is resident', async () => {
    const order: string[] = [];
    loadModel.mockImplementation(async () => {
      order.push('load');
    });
    const retry = jest.fn(async () => {
      order.push('retry');
    });

    await retryWithPinnedModel(gemma, retry);

    expect(order).toEqual(['load', 'retry']);
  });

  it('retries a chat already on its own model without reloading it', async () => {
    const retry = jest.fn(async () => {});

    await retryWithPinnedModel(qwen, retry);

    expect(loadModel).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
