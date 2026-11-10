import { ResourceFetcher } from 'react-native-executorch/legacy';
import { localWhisperModel, whisperSources } from '../utils/sttModelFiles';

const fetch = ResourceFetcher.fetch as jest.Mock;

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
