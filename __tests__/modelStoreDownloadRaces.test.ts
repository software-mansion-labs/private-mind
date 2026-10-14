import {
  useModelStore,
  ModelState,
  pauseDownloadsForBackground,
  resumeDownloadsAfterBackground,
} from '../store/modelStore';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher';
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

describe('a download while the app is in the background (UW-22)', () => {
  const sources = [
    model.modelPath,
    model.tokenizerPath,
    model.tokenizerConfigPath,
  ];

  const downloadUnderway = async () => {
    const started = download();
    await flushMicrotasks();
    await fetcher.releaseSizeLookups();
    return { started };
  };

  it('is paused when the app leaves, so Android cannot cut it, and resumed on return', async () => {
    const { started } = await downloadUnderway();

    await pauseDownloadsForBackground();
    expect(ExpoResourceFetcher.pauseFetching).toHaveBeenCalledWith(...sources);
    expect(status()).toBe(ModelState.Downloading);

    await resumeDownloadsAfterBackground();
    expect(ExpoResourceFetcher.resumeFetching).toHaveBeenCalledWith(...sources);

    await fetcher.finish(model.modelPath);
    await started;
    expect(status()).toBe(ModelState.Downloaded);
  });

  it('stays stopped when the user cancelled it while it was paused', async () => {
    const { started } = await downloadUnderway();
    await pauseDownloadsForBackground();

    await cancel();
    await resumeDownloadsAfterBackground();

    expect(ExpoResourceFetcher.resumeFetching).not.toHaveBeenCalled();
    await started;
  });

  it('still resumes when the app comes back before the pause has landed', async () => {
    const { started } = await downloadUnderway();
    let pauseLands = () => {};
    (ExpoResourceFetcher.pauseFetching as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          pauseLands = resolve;
        })
    );

    const pausing = pauseDownloadsForBackground();
    const resuming = resumeDownloadsAfterBackground();
    await flushMicrotasks();
    pauseLands();
    await pausing;
    await resuming;

    expect(ExpoResourceFetcher.resumeFetching).toHaveBeenCalledTimes(1);
    await fetcher.finish(model.modelPath);
    await started;
  });
});

describe('removing a model while it downloads', () => {
  const successToast = {
    type: 'defaultToast',
    text1: `${model.modelName} has been successfully downloaded`,
  };

  it('stops the download instead of letting it finish into a deleted row', async () => {
    useModelStore.setState({ models: [model] });
    (modelRepository.removeModelFiles as jest.Mock).mockResolvedValue(
      undefined
    );
    const started = download();
    await flushMicrotasks();
    await fetcher.releaseSizeLookups();
    await flushMicrotasks();
    expect(fetcher.activeSources()).toHaveLength(1);

    await settleWhileReleasing(useModelStore.getState().removeModel(model.id));
    await settleWhileReleasing(started);

    expect(fetcher.activeSources()).toEqual([]);
    expect(modelRepository.updateModelDownloaded).not.toHaveBeenCalledWith(
      expect.anything(),
      model.id,
      1
    );
    expect(Toast.show).not.toHaveBeenCalledWith(successToast);
  });
});
