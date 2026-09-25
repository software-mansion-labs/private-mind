import { useModelStore, ModelState } from '../store/modelStore';
import * as modelRepository from '../database/modelRepository';
import Toast from 'react-native-toast-message';
import {
  installFakeResourceFetcher,
  flushMicrotasks,
  type FakeResourceFetcher,
} from './support/resourceFetcherFake';

jest.mock('../database/modelRepository');

const model = {
  id: 1,
  modelName: 'Test Model',
  source: 'remote' as const,
  isDownloaded: false,
  modelPath: 'https://example.com/model.pte',
  tokenizerPath: 'https://example.com/tokenizer.json',
  tokenizerConfigPath: 'https://example.com/tokenizer_config.json',
};

let fetcher: FakeResourceFetcher;

const status = () =>
  useModelStore.getState().downloadStates[model.id]?.status ??
  ModelState.NotStarted;

const download = () => useModelStore.getState().downloadModel(model);
const cancel = () => useModelStore.getState().cancelDownload(model);

const settleWhileReleasing = async (work: Promise<unknown>) => {
  let settled = false;
  const finished = work.finally(() => {
    settled = true;
  });

  for (let attempt = 0; attempt < 200 && !settled; attempt++) {
    await fetcher.releaseSizeLookups();
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  await finished;
};

const failureToast = {
  type: 'defaultToast',
  text1: 'The model could not be downloaded',
};

beforeEach(() => {
  useModelStore.setState({
    db: {} as never,
    models: [],
    downloadedModels: [],
    downloadStates: {},
  });
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  (modelRepository.getAllModels as jest.Mock).mockResolvedValue([]);
  (modelRepository.updateModelDownloaded as jest.Mock).mockResolvedValue(
    undefined
  );
  fetcher = installFakeResourceFetcher();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('cancelling before the fetcher has registered the download', () => {
  it('still stops the download once it registers', async () => {
    const started = download();
    await flushMicrotasks();
    expect(fetcher.awaitingSizeLookup()).toBe(1);

    const cancelling = cancel();
    expect(status()).toBe(ModelState.NotStarted);

    await fetcher.releaseSizeLookups();
    await cancelling;

    expect(fetcher.activeSources()).toEqual([]);
    expect(status()).toBe(ModelState.NotStarted);
    await started;
  });

  it('does not announce a failure the user asked for', async () => {
    const started = download();
    await flushMicrotasks();

    const cancelling = cancel();
    await fetcher.releaseSizeLookups();
    await cancelling;
    await flushMicrotasks();

    expect(Toast.show).not.toHaveBeenCalledWith(failureToast);
    await started;
  });
});

describe('downloading again while the previous download is being cancelled', () => {
  it('waits for the cancelled download instead of colliding with it', async () => {
    const first = download();
    await flushMicrotasks();

    const cancelling = cancel();
    const second = download();

    await fetcher.releaseSizeLookups();
    await cancelling;
    await flushMicrotasks();
    await fetcher.releaseSizeLookups();
    await flushMicrotasks();

    expect(Toast.show).not.toHaveBeenCalledWith(failureToast);
    expect(status()).toBe(ModelState.Downloading);
    expect(fetcher.activeSources()).toHaveLength(1);

    await fetcher.finish(model.modelPath);
    await Promise.all([first, second]);
  });
});

describe('a burst of download and cancel taps', () => {
  it('leaves the card and the fetcher agreeing on not started', async () => {
    const taps: Promise<void>[] = [];

    for (let tap = 0; tap < 4; tap++) {
      taps.push(download());
      await flushMicrotasks();
      taps.push(cancel());
      await flushMicrotasks();
      await fetcher.releaseSizeLookups();
    }

    await settleWhileReleasing(Promise.all(taps));

    expect(status()).toBe(ModelState.NotStarted);
    expect(fetcher.activeSources()).toEqual([]);
  });
});
