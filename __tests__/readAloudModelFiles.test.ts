import { ResourceFetcher } from 'react-native-executorch/legacy';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import {
  fileNameOnDisk,
  isReadAloudDownloaded,
  localReadAloudModel,
  readAloudDownloadBytes,
  readAloudSources,
} from '../utils/readAloudModelFiles';

jest.mock('../utils/storageSpace', () => ({
  ensureStorageFor: jest.fn(),
}));

const mockFetch = ResourceFetcher.fetch as jest.Mock;

describe('readAloudSources', () => {
  it('asks for the backbone, decoder, tokenizer and one voice, never the encoder', () => {
    const sources = readAloudSources('pl_male_standard');
    expect(sources).toHaveLength(4);
    expect(sources.some((source) => /encoder/i.test(source))).toBe(false);
    expect(sources[3]).toContain('pl_male_standard.json');
  });
});

describe('readAloudDownloadBytes', () => {
  it('counts the backbone and the decoder but not the encoder', () => {
    const bytes = readAloudDownloadBytes();
    expect(bytes).toBeGreaterThan(300_000_000);
    expect(bytes).toBeLessThan(500_000_000);
  });
});

describe('isReadAloudDownloaded', () => {
  it('is true when every source is on disk', async () => {
    const files = readAloudSources('en_female_narrator').map(
      (source) => `file:///docs/${fileNameOnDisk(source)}`
    );
    (ExpoResourceFetcher.listDownloadedFiles as jest.Mock).mockResolvedValue(
      files
    );
    await expect(isReadAloudDownloaded('en_female_narrator')).resolves.toBe(
      true
    );
  });

  it('is false when a source is missing', async () => {
    const files = readAloudSources('en_female_narrator')
      .slice(1)
      .map((source) => `file:///docs/${fileNameOnDisk(source)}`);
    (ExpoResourceFetcher.listDownloadedFiles as jest.Mock).mockResolvedValue(
      files
    );
    await expect(isReadAloudDownloaded('en_female_narrator')).resolves.toBe(
      false
    );
  });
});

describe('localReadAloudModel', () => {
  beforeEach(() => {
    (ExpoResourceFetcher.listDownloadedFiles as jest.Mock).mockResolvedValue(
      []
    );
  });

  it('builds a model config of local paths holding only the requested voice', async () => {
    mockFetch.mockResolvedValueOnce([
      'file:///d/backbone.pte',
      'file:///d/decoder.pte',
      'file:///d/tokenizer.json',
      'file:///d/voice.json',
    ]);
    const progress = jest.fn();
    const model = await localReadAloudModel('de_female_standard', progress);
    expect(model).toEqual({
      name: 'reverb',
      modelPaths: {
        backbone: '/d/backbone.pte',
        codecDecoder: '/d/decoder.pte',
      },
      tokenizerPath: '/d/tokenizer.json',
      voices: { de_female_standard: '/d/voice.json' },
    });
    expect(mockFetch).toHaveBeenCalledWith(
      progress,
      ...readAloudSources('de_female_standard')
    );
  });

  it('fails when the download did not finish', async () => {
    mockFetch.mockResolvedValueOnce(null);
    await expect(
      localReadAloudModel('de_female_standard', jest.fn())
    ).rejects.toThrow('did not finish');
  });
});
