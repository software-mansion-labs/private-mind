import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import { LFM_2_5_EMBEDDING_SOURCES } from '../constants/embedding-model';
import {
  pauseFeatureDownloadsForBackground,
  resumeFeatureDownloadsAfterBackground,
} from '../utils/featureDownloadsInBackground';

jest.mock('../utils/sttModelFiles', () => ({
  whisperSources: () => [
    'https://hf.example/whisper/model.pte',
    'https://hf.example/whisper/tokenizer.json',
  ],
}));

const pause = ExpoResourceFetcher.pauseFetching as jest.Mock;
const resume = ExpoResourceFetcher.resumeFetching as jest.Mock;

const isEmbedding = (sources: string[]) =>
  sources.includes(LFM_2_5_EMBEDDING_SOURCES.modelSource as string);

beforeEach(async () => {
  await resumeFeatureDownloadsAfterBackground();
  pause.mockReset();
  resume.mockReset();
  resume.mockResolvedValue(undefined);
});

describe('feature downloads when the app goes to the background', () => {
  it('pauses the document model and Whisper downloads so Android cannot abort them', async () => {
    pause.mockResolvedValue(undefined);

    await pauseFeatureDownloadsForBackground();

    expect(pause).toHaveBeenCalledTimes(2);
    expect(pause.mock.calls.some(isEmbedding)).toBe(true);
    expect(
      pause.mock.calls.some((sources: string[]) =>
        sources.includes('https://hf.example/whisper/model.pte')
      )
    ).toBe(true);
  });

  it('resumes only what it paused when the app comes back', async () => {
    pause.mockImplementation(async (...sources: string[]) => {
      if (isEmbedding(sources)) throw new Error('not downloading');
    });

    await pauseFeatureDownloadsForBackground();
    await resumeFeatureDownloadsAfterBackground();

    expect(resume).toHaveBeenCalledTimes(1);
    expect(resume.mock.calls[0]).toEqual([
      'https://hf.example/whisper/model.pte',
      'https://hf.example/whisper/tokenizer.json',
    ]);
  });

  it('does not resume the same download twice after a second foreground', async () => {
    pause.mockResolvedValue(undefined);

    await pauseFeatureDownloadsForBackground();
    await resumeFeatureDownloadsAfterBackground();
    await resumeFeatureDownloadsAfterBackground();

    expect(resume).toHaveBeenCalledTimes(2);
  });
});
