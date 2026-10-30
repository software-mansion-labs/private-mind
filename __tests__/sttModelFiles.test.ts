import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import { ResourceFetcher } from 'react-native-executorch/legacy';
import {
  isWhisperDownloaded,
  localWhisperModel,
  whisperSources,
} from '../utils/sttModelFiles';

const list = ExpoResourceFetcher.listDownloadedFiles as jest.Mock;
const fetch = ResourceFetcher.fetch as jest.Mock;

describe('isWhisperDownloaded', () => {
  it('is true once the model, the tokenizer and the voice detector are on the phone', async () => {
    list.mockResolvedValueOnce([
      'file:///rne/whisper.pte',
      'file:///rne/tokenizer.json',
      'file:///rne/vad.pte',
    ]);

    expect(await isWhisperDownloaded()).toBe(true);
  });

  it('is false for a dictation set up before the voice detector existed', async () => {
    list.mockResolvedValueOnce([
      'file:///rne/whisper.pte',
      'file:///rne/tokenizer.json',
    ]);

    expect(await isWhisperDownloaded()).toBe(false);
  });

  it('is false when the download folder does not exist yet', async () => {
    list.mockRejectedValueOnce(new Error('not a directory'));

    expect(await isWhisperDownloaded()).toBe(false);
  });
});

describe('localWhisperModel', () => {
  it('fetches the three files and points the recognizer at them on disk', async () => {
    fetch.mockResolvedValueOnce([
      'file:///rne/whisper.pte',
      'file:///rne/tokenizer.json',
      'file:///rne/vad%20model.pte',
    ]);

    const model = await localWhisperModel(() => {});

    expect(fetch).toHaveBeenCalledWith(
      expect.any(Function),
      ...whisperSources()
    );
    expect(model.modelPath).toBe('/rne/whisper.pte');
    expect(model.tokenizerPath).toBe('/rne/tokenizer.json');
    expect(model.vadModel.modelPath).toBe('/rne/vad model.pte');
    expect(model.vadModel.defaultOptions).toEqual({ speechThreshold: 0.6 });
  });

  it('fails when the download is cancelled', async () => {
    fetch.mockResolvedValueOnce(null);

    await expect(localWhisperModel(() => {})).rejects.toThrow('did not finish');
  });
});
