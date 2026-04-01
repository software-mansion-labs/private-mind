import { renderHook } from '@testing-library/react-native';
import useModelHubData, { ModelHubFilter } from '../hooks/useModelHubData';
import * as modelCompatibility from '../utils/modelCompatibility';

jest.mock('../utils/modelCompatibility');
const mockIsModelCompatible = modelCompatibility.isModelCompatible as jest.Mock;

const makeModel = (overrides: Partial<{
  id: number;
  modelName: string;
  source: 'built-in' | 'remote' | 'local';
  isDownloaded: boolean;
  featured: boolean;
  parameters: number;
}> = {}) => ({
  id: 1,
  modelName: 'Llama-3B',
  source: 'built-in' as const,
  isDownloaded: false,
  featured: false,
  parameters: 3,
  modelPath: '',
  tokenizerPath: '',
  tokenizerConfigPath: '',
  thinking: false,
  ...overrides,
});

beforeEach(() => {
  mockIsModelCompatible.mockReturnValue(true);
});

// ─── search ──────────────────────────────────────────────────────────────────

describe('search', () => {
  it('returns all models when search is empty', () => {
    const models = [makeModel({ modelName: 'Llama-3B' }), makeModel({ id: 2, modelName: 'Qwen-1B' })];
    const { result } = renderHook(() =>
      useModelHubData({ models, search: '', activeFilters: new Set(), groupByModel: false })
    );
    const all = result.current.groupedModels.flatMap((g) => g.models);
    expect(all).toHaveLength(2);
  });

  it('filters by search string (case-insensitive)', () => {
    const models = [makeModel({ modelName: 'Llama-3B' }), makeModel({ id: 2, modelName: 'Qwen-1B' })];
    const { result } = renderHook(() =>
      useModelHubData({ models, search: 'qwen', activeFilters: new Set(), groupByModel: false })
    );
    const all = result.current.groupedModels.flatMap((g) => g.models);
    expect(all).toHaveLength(1);
    expect(all[0].modelName).toBe('Qwen-1B');
  });

  it('returns isEmpty=true when nothing matches search', () => {
    const models = [makeModel({ modelName: 'Llama-3B' })];
    const { result } = renderHook(() =>
      useModelHubData({ models, search: 'gpt', activeFilters: new Set(), groupByModel: false })
    );
    expect(result.current.isEmpty).toBe(true);
  });
});

// ─── filters ─────────────────────────────────────────────────────────────────

describe('Featured filter', () => {
  it('excludes non-featured built-in models when Featured filter is active', () => {
    const models = [
      makeModel({ id: 1, modelName: 'A', source: 'built-in', featured: false }),
      makeModel({ id: 2, modelName: 'B', source: 'built-in', featured: true }),
    ];
    const { result } = renderHook(() =>
      useModelHubData({
        models,
        search: '',
        activeFilters: new Set([ModelHubFilter.Featured]),
        groupByModel: false,
      })
    );
    const all = result.current.groupedModels.flatMap((g) => g.models);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(2);
  });

  it('does not exclude remote/local models regardless of featured flag', () => {
    const models = [
      makeModel({ id: 1, source: 'remote', featured: false }),
      makeModel({ id: 2, source: 'local', featured: false }),
    ];
    const { result } = renderHook(() =>
      useModelHubData({
        models,
        search: '',
        activeFilters: new Set([ModelHubFilter.Featured]),
        groupByModel: false,
      })
    );
    const all = result.current.groupedModels.flatMap((g) => g.models);
    expect(all).toHaveLength(2);
  });
});

describe('Downloaded filter', () => {
  it('excludes non-downloaded models when Downloaded filter is active', () => {
    const models = [
      makeModel({ id: 1, isDownloaded: true }),
      makeModel({ id: 2, isDownloaded: false }),
    ];
    const { result } = renderHook(() =>
      useModelHubData({
        models,
        search: '',
        activeFilters: new Set([ModelHubFilter.Downloaded]),
        groupByModel: false,
      })
    );
    const all = result.current.groupedModels.flatMap((g) => g.models);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(1);
  });
});

describe('Compatible filter', () => {
  it('excludes incompatible models when Compatible filter is active', () => {
    mockIsModelCompatible.mockImplementation((m) => m.id === 1);
    const models = [makeModel({ id: 1 }), makeModel({ id: 2 })];
    const { result } = renderHook(() =>
      useModelHubData({
        models,
        search: '',
        activeFilters: new Set([ModelHubFilter.Compatible]),
        groupByModel: false,
      })
    );
    const all = result.current.groupedModels.flatMap((g) => g.models);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(1);
  });
});

describe('combined filters', () => {
  it('applies all active filters together (AND logic)', () => {
    mockIsModelCompatible.mockReturnValue(true);
    const models = [
      makeModel({ id: 1, isDownloaded: true, featured: true, source: 'built-in' }),
      makeModel({ id: 2, isDownloaded: false, featured: true, source: 'built-in' }),
      makeModel({ id: 3, isDownloaded: true, featured: false, source: 'built-in' }),
    ];
    const { result } = renderHook(() =>
      useModelHubData({
        models,
        search: '',
        activeFilters: new Set([ModelHubFilter.Featured, ModelHubFilter.Downloaded]),
        groupByModel: false,
      })
    );
    const all = result.current.groupedModels.flatMap((g) => g.models);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(1);
  });
});

// ─── grouping ─────────────────────────────────────────────────────────────────

describe('groupByModel=false (default sections)', () => {
  it('splits into "Ready to Use" and "Available to Download"', () => {
    const models = [
      makeModel({ id: 1, isDownloaded: true }),
      makeModel({ id: 2, isDownloaded: false }),
    ];
    const { result } = renderHook(() =>
      useModelHubData({ models, search: '', activeFilters: new Set(), groupByModel: false })
    );
    const labels = result.current.groupedModels.map((g) => g.label);
    expect(labels).toContain('Ready to Use');
    expect(labels).toContain('Available to Download');

    const ready = result.current.groupedModels.find((g) => g.label === 'Ready to Use')!;
    const available = result.current.groupedModels.find((g) => g.label === 'Available to Download')!;
    expect(ready.models.every((m) => m.isDownloaded)).toBe(true);
    expect(available.models.every((m) => !m.isDownloaded)).toBe(true);
  });
});

describe('groupByModel=true (prefix grouping)', () => {
  it('groups models by name prefix', () => {
    const models = [
      makeModel({ id: 1, modelName: 'Llama-3B', isDownloaded: true }),
      makeModel({ id: 2, modelName: 'Llama-7B', isDownloaded: false }),
      makeModel({ id: 3, modelName: 'Qwen-1B', isDownloaded: false }),
    ];
    const { result } = renderHook(() =>
      useModelHubData({ models, search: '', activeFilters: new Set(), groupByModel: true })
    );
    const labels = result.current.groupedModels.map((g) => g.label);
    expect(labels).toContain('llama');
    expect(labels).toContain('qwen');

    const llamaGroup = result.current.groupedModels.find((g) => g.label === 'llama')!;
    expect(llamaGroup.models).toHaveLength(2);
  });
});

// ─── sorting ──────────────────────────────────────────────────────────────────

describe('available models sorting', () => {
  it('sorts available models by parameters ascending', () => {
    const models = [
      makeModel({ id: 1, modelName: 'Big', parameters: 7, isDownloaded: false }),
      makeModel({ id: 2, modelName: 'Small', parameters: 1, isDownloaded: false }),
      makeModel({ id: 3, modelName: 'Medium', parameters: 3, isDownloaded: false }),
    ];
    const { result } = renderHook(() =>
      useModelHubData({ models, search: '', activeFilters: new Set(), groupByModel: false })
    );
    const available = result.current.groupedModels.find((g) => g.label === 'Available to Download')!;
    expect(available.models.map((m) => m.parameters)).toEqual([1, 3, 7]);
  });

  it('falls back to alphabetical sort when parameters are equal', () => {
    const models = [
      makeModel({ id: 1, modelName: 'Zebra', parameters: 3, isDownloaded: false }),
      makeModel({ id: 2, modelName: 'Apple', parameters: 3, isDownloaded: false }),
    ];
    const { result } = renderHook(() =>
      useModelHubData({ models, search: '', activeFilters: new Set(), groupByModel: false })
    );
    const available = result.current.groupedModels.find((g) => g.label === 'Available to Download')!;
    expect(available.models[0].modelName).toBe('Apple');
  });
});
