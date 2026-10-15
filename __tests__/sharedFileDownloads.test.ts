import {
  useModelStore,
  ModelState,
  resetDownloadAttempts,
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

const QWEN_3 =
  'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.9.0';
const tokenizer = `${QWEN_3}/tokenizer.json`;
const tokenizerConfig = `${QWEN_3}/tokenizer_config.json`;

const small = {
  id: 1,
  modelName: 'Qwen 3 - 0.6B',
  source: 'built-in' as const,
  isDownloaded: false,
  modelPath: `${QWEN_3}/0_6b/xnnpack/qwen_3_0_6b_xnnpack_8da4w.pte`,
  tokenizerPath: tokenizer,
  tokenizerConfigPath: tokenizerConfig,
};

const large = {
  ...small,
  id: 2,
  modelName: 'Qwen 3 - 1.7B',
  modelPath: `${QWEN_3}/1_7b/xnnpack/qwen_3_1_7b_xnnpack_8da4w.pte`,
};

let fetcher: FakeResourceFetcher;

const status = (model: typeof small) =>
  useModelStore.getState().downloadStates[model.id]?.status ??
  ModelState.NotStarted;

const download = (model: typeof small) =>
  useModelStore.getState().downloadModel(model);
const cancel = (model: typeof small) =>
  useModelStore.getState().cancelDownload(model);

const markedDownloaded = (model: typeof small) =>
  (modelRepository.updateModelDownloaded as jest.Mock).mock.calls.some(
    ([, id, downloaded]) => id === model.id && downloaded === 1
  );

const failureToastShown = () =>
  (Toast.show as jest.Mock).mock.calls.some(([toast]) =>
    /could not be downloaded|interrupted/.test(toast.text1)
  );

const settle = async () => {
  for (let round = 0; round < 5; round++) {
    await fetcher.releaseSizeLookups();
    await flushMicrotasks();
  }
};

const smallHoldsTheTokenizerWhileLargeReachesIt = async () => {
  const downloads = Promise.all([download(small), download(large)]);
  await settle();
  expect(fetcher.activeSources()).toEqual([small.modelPath, large.modelPath]);

  await fetcher.finish(small.modelPath);
  await settle();
  expect(fetcher.activeSources()).toContain(tokenizer);

  await fetcher.finish(large.modelPath);
  await settle();
  return { downloads };
};

beforeEach(() => {
  useModelStore.setState({
    db: {} as never,
    models: [],
    downloadedModels: [],
    downloadStates: {},
  });
  resetDownloadAttempts();
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

describe('two models that share a tokenizer, downloaded together', () => {
  it('keeps the second one downloading when it reaches the tokenizer the first is still fetching', async () => {
    const { downloads } = await smallHoldsTheTokenizerWhileLargeReachesIt();

    expect(status(large)).toBe(ModelState.Downloading);
    expect(failureToastShown()).toBe(false);

    await fetcher.finishEverything();
    await downloads;
  });

  it('finishes both without a retry and fetches the shared files once', async () => {
    const { downloads } = await smallHoldsTheTokenizerWhileLargeReachesIt();

    await fetcher.finishEverything();
    await downloads;

    expect(status(small)).toBe(ModelState.Downloaded);
    expect(status(large)).toBe(ModelState.Downloaded);
    expect(markedDownloaded(small)).toBe(true);
    expect(markedDownloaded(large)).toBe(true);
    expect(fetcher.timesDownloaded(tokenizer)).toBe(1);
    expect(fetcher.timesDownloaded(tokenizerConfig)).toBe(1);
    expect(failureToastShown()).toBe(false);
  });

  it('finishes both when their model files are already on disk and they start in the same tick', async () => {
    fetcher.putOnDisk(small.modelPath, large.modelPath);

    const downloads = Promise.all([download(small), download(large)]);
    await fetcher.finishEverything();
    await downloads;

    expect(status(small)).toBe(ModelState.Downloaded);
    expect(status(large)).toBe(ModelState.Downloaded);
    expect(fetcher.timesDownloaded(tokenizer)).toBe(1);
    expect(failureToastShown()).toBe(false);
  });
});

describe('cancelling one of two models that share a tokenizer', () => {
  it('lets the waiting model fetch the tokenizer itself when the one fetching it is cancelled', async () => {
    const { downloads } = await smallHoldsTheTokenizerWhileLargeReachesIt();

    await cancel(small);
    await settle();

    expect(status(small)).toBe(ModelState.NotStarted);
    expect(fetcher.activeSources()).toEqual([tokenizer]);
    expect(fetcher.timesDownloaded(tokenizer)).toBe(2);

    await fetcher.finishEverything();
    await downloads;

    expect(status(large)).toBe(ModelState.Downloaded);
    expect(markedDownloaded(small)).toBe(false);
    expect(failureToastShown()).toBe(false);
  });

  it('leaves the shared download alone when the waiting model is cancelled', async () => {
    const { downloads } = await smallHoldsTheTokenizerWhileLargeReachesIt();

    await cancel(large);
    await settle();

    expect(status(large)).toBe(ModelState.NotStarted);
    expect(fetcher.activeSources()).toEqual([tokenizer]);
    expect(ExpoResourceFetcher.cancelFetching).not.toHaveBeenCalled();

    await fetcher.finishEverything();
    await downloads;

    expect(status(small)).toBe(ModelState.Downloaded);
    expect(markedDownloaded(large)).toBe(false);
    expect(failureToastShown()).toBe(false);
  });
});

describe('two models that share a tokenizer, while the app is in the background', () => {
  it('pauses and resumes the shared file once, through the model fetching it', async () => {
    const { downloads } = await smallHoldsTheTokenizerWhileLargeReachesIt();

    await pauseDownloadsForBackground();
    await resumeDownloadsAfterBackground();

    expect(ExpoResourceFetcher.pauseFetching).toHaveBeenCalledTimes(1);
    expect(ExpoResourceFetcher.pauseFetching).toHaveBeenCalledWith(tokenizer);
    expect(ExpoResourceFetcher.resumeFetching).toHaveBeenCalledTimes(1);
    expect(ExpoResourceFetcher.resumeFetching).toHaveBeenCalledWith(tokenizer);

    await fetcher.finishEverything();
    await downloads;

    expect(status(small)).toBe(ModelState.Downloaded);
    expect(status(large)).toBe(ModelState.Downloaded);
  });
});

describe('progress of a model fetched file by file', () => {
  const progress = (model: typeof small) =>
    useModelStore.getState().downloadStates[model.id]?.progress ?? 0;
  const pastTheFrameThrottle = () =>
    new Promise((resolve) => setTimeout(resolve, 20));

  it('weighs each file by its size, so the shared tokenizer moves the bar from where the model file left it', async () => {
    fetcher.setSize(small.modelPath, 900);
    fetcher.setSize(tokenizer, 90);
    fetcher.setSize(tokenizerConfig, 10);

    const started = download(small);
    await settle();
    await pastTheFrameThrottle();
    fetcher.reportProgress(small.modelPath, 0.5);
    expect(progress(small)).toBeCloseTo(0.45);

    await fetcher.finish(small.modelPath);
    await settle();
    await pastTheFrameThrottle();
    fetcher.reportProgress(tokenizer, 0.5);
    expect(progress(small)).toBeCloseTo(0.945);

    await fetcher.finishEverything();
    await started;
    expect(progress(small)).toBe(1);
  });
});
