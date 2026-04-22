import { useModelStore, ModelState } from '../store/modelStore';
import * as modelRepository from '../database/modelRepository';
import { ResourceFetcher } from 'react-native-executorch';
import { exists, unlink } from '@dr.pogodin/react-native-fs';
import Toast from 'react-native-toast-message';

jest.mock('../database/modelRepository');

const mockDb = {} as any;
const mockFetch = ResourceFetcher.fetch as jest.Mock;
const mockExists = exists as jest.Mock;
const mockUnlink = unlink as jest.Mock;
const mockGetAllModels = modelRepository.getAllModels as jest.Mock;
const mockUpdateModelDownloaded =
  modelRepository.updateModelDownloaded as jest.Mock;
const mockRemoveModelFiles = modelRepository.removeModelFiles as jest.Mock;

const baseModel = {
  id: 1,
  modelName: 'Test Model',
  source: 'remote' as const,
  isDownloaded: false,
  modelPath: 'https://example.com/model.pte',
  tokenizerPath: 'https://example.com/tokenizer.json',
  tokenizerConfigPath: 'https://example.com/tokenizer_config.json',
};

beforeEach(() => {
  useModelStore.setState({
    db: mockDb,
    models: [],
    downloadedModels: [],
    downloadStates: {},
  });
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockGetAllModels.mockResolvedValue([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getModelById', () => {
  it('returns matching model', () => {
    useModelStore.setState({ models: [{ ...baseModel, id: 3 }] });
    expect(useModelStore.getState().getModelById(3)?.id).toBe(3);
  });

  it('returns undefined for unknown id', () => {
    useModelStore.setState({ models: [baseModel] });
    expect(useModelStore.getState().getModelById(999)).toBeUndefined();
  });
});

describe('downloadModel', () => {
  it('sets state to Downloading at start', async () => {
    // Never resolve so we can inspect mid-flight state
    mockFetch.mockReturnValue(new Promise(() => {}));

    useModelStore.getState().downloadModel(baseModel);

    const state = useModelStore.getState().downloadStates[baseModel.id];
    expect(state.status).toBe(ModelState.Downloading);
    expect(state.progress).toBe(0);
  });

  it('sets state to Downloaded with progress=1 on success', async () => {
    mockFetch.mockResolvedValue(['/local/model.pte']);
    mockUpdateModelDownloaded.mockResolvedValue(undefined);

    await useModelStore.getState().downloadModel(baseModel);

    const state = useModelStore.getState().downloadStates[baseModel.id];
    expect(state.status).toBe(ModelState.Downloaded);
    expect(state.progress).toBe(1);
  });

  it('shows success toast on download complete', async () => {
    mockFetch.mockResolvedValue(['/local/model.pte']);
    mockUpdateModelDownloaded.mockResolvedValue(undefined);

    await useModelStore.getState().downloadModel(baseModel);

    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: expect.stringContaining('Test Model') })
    );
  });

  it('resets to NotStarted and shows error toast on failure', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));

    await useModelStore.getState().downloadModel(baseModel);

    const state = useModelStore.getState().downloadStates[baseModel.id];
    expect(state.status).toBe(ModelState.NotStarted);
    expect(state.progress).toBe(0);
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        text1: expect.stringContaining('could not be downloaded'),
      })
    );
  });

  it('ignores progress updates that arrive after download completes (race condition guard)', async () => {
    let capturedProgressCb: (p: number) => void = () => {};
    mockFetch.mockImplementation((cb: (p: number) => void) => {
      capturedProgressCb = cb;
      return Promise.resolve(['/local/model.pte']);
    });
    mockUpdateModelDownloaded.mockResolvedValue(undefined);

    await useModelStore.getState().downloadModel(baseModel);

    // Simulate late progress callback firing after completion
    capturedProgressCb(0.5);

    const state = useModelStore.getState().downloadStates[baseModel.id];
    // Should still be Downloaded, not overwritten back to Downloading
    expect(state.status).toBe(ModelState.Downloaded);
    expect(state.progress).toBe(1);
  });

  it('throttles progress updates — does not report same percentage twice', async () => {
    let capturedCb: (p: number) => void = () => {};
    mockFetch.mockImplementation((cb: (p: number) => void) => {
      capturedCb = cb;
      return new Promise((resolve) => {
        // fire several updates then resolve
        setTimeout(() => {
          capturedCb(0.1);
          capturedCb(0.1); // same percent — should be ignored
          resolve(['/local/model.pte']);
        }, 0);
      });
    });
    mockUpdateModelDownloaded.mockResolvedValue(undefined);

    const setStateSpy = jest.spyOn(useModelStore, 'setState');
    await useModelStore.getState().downloadModel(baseModel);

    const progressCalls = setStateSpy.mock.calls.filter((call) => {
      const arg =
        typeof call[0] === 'function'
          ? call[0](useModelStore.getState())
          : call[0];
      return (
        arg?.downloadStates?.[baseModel.id]?.status ===
          ModelState.Downloading &&
        arg?.downloadStates?.[baseModel.id]?.progress > 0
      );
    });
    // Duplicate percentage should not have been reported twice
    expect(progressCalls.length).toBeLessThanOrEqual(1);
    setStateSpy.mockRestore();
  });

  it('returns early without updating state when fetch returns null', async () => {
    mockFetch.mockResolvedValue(null);

    await useModelStore.getState().downloadModel(baseModel);

    // No DB update, no toast, state stays Downloading (was set at start)
    expect(mockUpdateModelDownloaded).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });
});

describe('cancelDownload', () => {
  it('resets download state to NotStarted with progress 0', async () => {
    useModelStore.setState({
      downloadStates: {
        [baseModel.id]: { progress: 0.5, status: ModelState.Downloading },
      },
    });

    await useModelStore.getState().cancelDownload(baseModel);

    const state = useModelStore.getState().downloadStates[baseModel.id];
    expect(state.status).toBe(ModelState.NotStarted);
    expect(state.progress).toBe(0);
  });
});

describe('removeModel', () => {
  it('skips file deletion for local/built-in models', async () => {
    const localModel = {
      ...baseModel,
      source: 'local' as const,
      isDownloaded: true,
    };
    useModelStore.setState({ models: [localModel] });
    mockRemoveModelFiles.mockResolvedValue(undefined);

    await useModelStore.getState().removeModel(localModel.id);

    expect(mockUnlink).not.toHaveBeenCalled();
    expect(mockUpdateModelDownloaded).not.toHaveBeenCalled();
  });

  it('deletes local files and marks not-downloaded for remote models', async () => {
    const remoteModel = { ...baseModel, isDownloaded: true };
    mockExists.mockResolvedValue(true);
    mockUnlink.mockResolvedValue(undefined);
    mockUpdateModelDownloaded.mockResolvedValue(undefined);
    mockRemoveModelFiles.mockResolvedValue(undefined);

    // First: download so the module-level downloadedPaths Map is populated
    mockFetch.mockResolvedValue(['/local/model.pte', '/local/tokenizer.json']);
    useModelStore.setState({ models: [remoteModel], db: mockDb });
    await useModelStore.getState().downloadModel(remoteModel);

    // Reset mocks so we can assert cleanly on the removeModel call
    jest.clearAllMocks();
    mockExists.mockResolvedValue(true);
    mockUnlink.mockResolvedValue(undefined);
    mockUpdateModelDownloaded.mockResolvedValue(undefined);
    mockRemoveModelFiles.mockResolvedValue(undefined);
    mockGetAllModels.mockResolvedValue([]);

    // Still have the model in state
    useModelStore.setState({ models: [remoteModel], db: mockDb });
    await useModelStore.getState().removeModel(remoteModel.id);

    expect(mockUnlink).toHaveBeenCalledWith('/local/model.pte');
    expect(mockUnlink).toHaveBeenCalledWith('/local/tokenizer.json');
    expect(mockUpdateModelDownloaded).toHaveBeenCalledWith(
      mockDb,
      remoteModel.id,
      0
    );
  });

  it('removes download state entry after removal', async () => {
    const remoteModel = { ...baseModel, isDownloaded: true };
    useModelStore.setState({
      models: [remoteModel],
      downloadStates: {
        [remoteModel.id]: { progress: 1, status: ModelState.Downloaded },
      },
    });
    mockExists.mockResolvedValue(false);
    mockUpdateModelDownloaded.mockResolvedValue(undefined);
    mockRemoveModelFiles.mockResolvedValue(undefined);

    await useModelStore.getState().removeModel(remoteModel.id);

    expect(
      useModelStore.getState().downloadStates[remoteModel.id]
    ).toBeUndefined();
  });

  it('does nothing for unknown model id', async () => {
    useModelStore.setState({ models: [] });
    await useModelStore.getState().removeModel(999);
    expect(mockRemoveModelFiles).not.toHaveBeenCalled();
  });
});

describe('removeModelFiles vs removeModel', () => {
  it('removeModelFiles does not call removeModelFiles DB function (only marks not downloaded)', async () => {
    const remoteModel = { ...baseModel, isDownloaded: true };
    useModelStore.setState({ models: [remoteModel] });
    mockExists.mockResolvedValue(false);
    mockUpdateModelDownloaded.mockResolvedValue(undefined);

    await useModelStore.getState().removeModelFiles(remoteModel.id);

    // updateModelDownloaded called but removeModelFiles (DB) NOT called
    expect(mockUpdateModelDownloaded).toHaveBeenCalledWith(
      mockDb,
      remoteModel.id,
      0
    );
    expect(mockRemoveModelFiles).not.toHaveBeenCalled();
  });

  it('removeModel calls removeModelFiles (DB) to fully delete the record', async () => {
    const remoteModel = { ...baseModel, isDownloaded: true };
    useModelStore.setState({ models: [remoteModel] });
    mockExists.mockResolvedValue(false);
    mockUpdateModelDownloaded.mockResolvedValue(undefined);
    mockRemoveModelFiles.mockResolvedValue(undefined);

    await useModelStore.getState().removeModel(remoteModel.id);

    expect(mockRemoveModelFiles).toHaveBeenCalledWith(mockDb, remoteModel.id);
  });
});
