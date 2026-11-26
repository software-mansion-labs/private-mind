import { Platform } from 'react-native';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import { ResourceFetcher } from 'react-native-executorch/legacy';
import {
  deleteWhisperFiles,
  downloadedFilenameOf,
  isWhisperDownloaded,
  localWhisperModel,
  whisperDownloadSizeBytes,
  whisperDownloadSizeLabel,
  whisperModel,
  whisperSources,
  type SttModelKind,
} from '../utils/sttModelFiles';

const list = ExpoResourceFetcher.listDownloadedFiles as jest.Mock;
const remove = ExpoResourceFetcher.deleteResources as jest.Mock;
const fetch = ResourceFetcher.fetch as jest.Mock;

const RNE_DIRECTORY = 'file:///data/react-native-executorch/';

const onDisk = (...sources: string[]) =>
  sources.map((source) => `${RNE_DIRECTORY}${downloadedFilenameOf(source)}`);

const filesOf = (kind: SttModelKind) => onDisk(...whisperSources(kind));

const withPlatform = (os: typeof Platform.OS, run: () => void) => {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  try {
    run();
  } finally {
    Object.defineProperty(Platform, 'OS', {
      value: original,
      configurable: true,
    });
  }
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('which Whisper each kind of dictation uses', () => {
  it('keeps English on the English-only tiny model', () => {
    expect(whisperModel('english').supportedLanguages).toEqual(['en']);
    expect(whisperModel('english').modelPath).toContain('whisper-tiny.en/');
  });

  it('uses the multilingual tiny model for every other language', () => {
    expect(whisperModel('multilingual').modelPath).toContain('whisper-tiny/');
    expect(whisperModel('multilingual').supportedLanguages).toContain('pl');
  });

  it('runs Core ML on iOS and XNNPACK on Android for both kinds', () => {
    withPlatform('ios', () => {
      expect(whisperModel('english').modelPath).toContain('/coreml/');
      expect(whisperModel('multilingual').modelPath).toContain('/coreml/');
    });
    withPlatform('android', () => {
      expect(whisperModel('english').modelPath).toContain('/xnnpack/');
      expect(whisperModel('multilingual').modelPath).toContain('/xnnpack/');
    });
  });

  it('shares one voice detector between the two models', () => {
    expect(whisperSources('english')[2]).toBe(
      whisperSources('multilingual')[2]
    );
  });
});

describe('download sizes', () => {
  it('leaves the English download size as it was', () => {
    withPlatform('ios', () => {
      expect(whisperDownloadSizeBytes('english')).toBe(80_710_511);
    });
    withPlatform('android', () => {
      expect(whisperDownloadSizeBytes('english')).toBe(236_839_695);
    });
  });

  it('states the multilingual download in megabytes before it starts', () => {
    withPlatform('ios', () => {
      expect(whisperDownloadSizeLabel('multilingual')).toBe('81 MB');
    });
    withPlatform('android', () => {
      expect(whisperDownloadSizeLabel('multilingual')).toBe('237 MB');
    });
  });
});

describe('isWhisperDownloaded', () => {
  it('is true once the model, the tokenizer and the voice detector are on the phone', async () => {
    list.mockResolvedValueOnce(filesOf('english'));

    expect(await isWhisperDownloaded('english')).toBe(true);
  });

  it('is false for a dictation set up before the voice detector existed', async () => {
    list.mockResolvedValueOnce(filesOf('english').slice(0, 2));

    expect(await isWhisperDownloaded('english')).toBe(false);
  });

  it('does not mistake the English tokenizer for the multilingual one', async () => {
    const [multilingualModel, , detector] = whisperSources('multilingual');
    list.mockResolvedValueOnce([
      ...filesOf('english'),
      ...onDisk(multilingualModel, detector),
    ]);

    expect(await isWhisperDownloaded('multilingual')).toBe(false);
  });

  it('tells the two kinds apart', async () => {
    list.mockResolvedValue(filesOf('multilingual'));

    expect(await isWhisperDownloaded('multilingual')).toBe(true);
    expect(await isWhisperDownloaded('english')).toBe(false);
  });

  it('is false when the download folder does not exist yet', async () => {
    list.mockRejectedValueOnce(new Error('not a directory'));

    expect(await isWhisperDownloaded('english')).toBe(false);
  });
});

describe('localWhisperModel', () => {
  it('fetches the three files and points the recognizer at them on disk', async () => {
    fetch.mockResolvedValueOnce([
      'file:///rne/whisper.pte',
      'file:///rne/tokenizer.json',
      'file:///rne/vad%20model.pte',
    ]);

    const model = await localWhisperModel('english', () => {});

    expect(fetch).toHaveBeenCalledWith(
      expect.any(Function),
      ...whisperSources('english')
    );
    expect(model.modelPath).toBe('/rne/whisper.pte');
    expect(model.tokenizerPath).toBe('/rne/tokenizer.json');
    expect(model.vadModel.modelPath).toBe('/rne/vad model.pte');
    expect(model.vadModel.defaultOptions).toEqual({ speechThreshold: 0.6 });
  });

  it('fetches the multilingual files and keeps its language list', async () => {
    fetch.mockResolvedValueOnce([
      'file:///rne/whisper-multi.pte',
      'file:///rne/tokenizer-multi.json',
      'file:///rne/vad.pte',
    ]);

    const model = await localWhisperModel('multilingual', () => {});

    expect(fetch).toHaveBeenCalledWith(
      expect.any(Function),
      ...whisperSources('multilingual')
    );
    expect(model.modelPath).toBe('/rne/whisper-multi.pte');
    expect(model.supportedLanguages).toContain('pl');
  });

  it('fails when the download is cancelled', async () => {
    fetch.mockResolvedValueOnce(null);

    await expect(localWhisperModel('english', () => {})).rejects.toThrow(
      'did not finish'
    );
  });
});

describe('deleteWhisperFiles', () => {
  it('keeps the shared voice detector while the other model still needs it', async () => {
    list.mockResolvedValueOnce(filesOf('english'));
    const [model, tokenizer] = whisperSources('multilingual');

    await deleteWhisperFiles('multilingual');

    expect(remove).toHaveBeenCalledWith(model, tokenizer);
  });

  it('removes the voice detector with the last model on the phone', async () => {
    list.mockResolvedValueOnce([]);

    await deleteWhisperFiles('english');

    expect(remove).toHaveBeenCalledWith(...whisperSources('english'));
  });
});
