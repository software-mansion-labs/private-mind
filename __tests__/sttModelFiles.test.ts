import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import { isWhisperDownloaded } from '../utils/sttModelFiles';

jest.mock('react-native-executorch/legacy', () => ({
  WHISPER_TINY_EN: {
    modelName: 'whisper-tiny-en',
    modelSource: 'https://example.com/v1/xnnpack/whisper_tiny_en.pte',
    tokenizerSource: 'https://example.com/v1/tokenizer.json?download=true',
  },
}));

const list = ExpoResourceFetcher.listDownloadedFiles as jest.Mock;

describe('isWhisperDownloaded', () => {
  it('is true once the model and the tokenizer are both on the phone', async () => {
    list.mockResolvedValueOnce([
      'file:///rne/whisper_tiny_en.pte',
      'file:///rne/tokenizer.json',
    ]);

    expect(await isWhisperDownloaded()).toBe(true);
  });

  it('is false while one of the two files is missing', async () => {
    list.mockResolvedValueOnce(['file:///rne/whisper_tiny_en.pte']);

    expect(await isWhisperDownloaded()).toBe(false);
  });

  it('is false when the download folder does not exist yet', async () => {
    list.mockRejectedValueOnce(new Error('not a directory'));

    expect(await isWhisperDownloaded()).toBe(false);
  });
});
