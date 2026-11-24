import { renderHook, waitFor } from '@testing-library/react-native';
import { useLastUsedModel } from '../hooks/useLastUsedModel';
import { useModelStore } from '../store/modelStore';
import { getLastUsedModelId } from '../utils/lastUsedModel';
import type { Model } from '../database/modelRepository';

jest.mock('../utils/lastUsedModel', () => ({
  getLastUsedModelId: jest.fn(),
}));

const lfm = { id: 7, modelName: 'LFM 3 - 1.7B' } as Model;

beforeEach(() => {
  useModelStore.setState({
    getModelById: (id) => (id === 7 ? lfm : undefined),
  });
});

describe('useLastUsedModel', () => {
  it('resolves the stored id to its model', async () => {
    (getLastUsedModelId as jest.Mock).mockResolvedValue(7);
    const { result } = renderHook(() => useLastUsedModel());
    await waitFor(() => expect(result.current).toBe(lfm));
  });

  it('is null when no chat has used a model yet', async () => {
    (getLastUsedModelId as jest.Mock).mockResolvedValue(null);
    const { result } = renderHook(() => useLastUsedModel());
    await waitFor(() => expect(getLastUsedModelId).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('is null when the stored model is no longer in the catalog', async () => {
    (getLastUsedModelId as jest.Mock).mockResolvedValue(99);
    const { result } = renderHook(() => useLastUsedModel());
    await waitFor(() => expect(getLastUsedModelId).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
