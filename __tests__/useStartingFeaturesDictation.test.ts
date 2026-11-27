import { act, renderHook, waitFor } from '@testing-library/react-native';
import { getLocales } from 'expo-localization';
import {
  type StartingFeature,
  useStartingFeatures,
} from '../hooks/useStartingFeatures';
import { useSettingsStore } from '../store/settingsStore';
import { useSTTStore } from '../store/sttStore';
import {
  isWhisperDownloaded,
  whisperDownloadSizeBytes,
} from '../utils/sttModelFiles';

jest.mock('../context/VectorStoreContext', () => ({
  useVectorStore: () => ({ vectorStore: null, embeddings: null }),
}));

jest.mock('../utils/sttModelFiles', () => ({
  ...jest.requireActual('../utils/sttModelFiles'),
  isWhisperDownloaded: jest.fn(async () => false),
}));

const BYTES_PER_GB = 1_000_000_000;
const fetchFiles = jest.fn(async () => true);

const dictationFeature = (features: StartingFeature[]) =>
  features.find((feature) => feature.key === 'dictation')!;

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ dictationLanguage: 'phone' });
  useSTTStore.setState({
    isReady: false,
    moduleKind: null,
    isFetchingFiles: false,
    fetchingKind: null,
    fetchFiles,
  });
});

describe('voice dictation on the first-run screen', () => {
  it('offers the English model on an English phone', async () => {
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
    const { result } = renderHook(() => useStartingFeatures());

    expect(dictationFeature(result.current.features).sizeGb).toBe(
      whisperDownloadSizeBytes('english') / BYTES_PER_GB
    );
    await act(async () => {
      await result.current.download('dictation');
    });
    expect(fetchFiles).toHaveBeenCalledWith('english');
  });

  it('offers the multilingual model on a Polish phone', async () => {
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'pl' }]);
    const { result } = renderHook(() => useStartingFeatures());

    expect(dictationFeature(result.current.features).sizeGb).toBe(
      whisperDownloadSizeBytes('multilingual') / BYTES_PER_GB
    );
    await act(async () => {
      await result.current.download('dictation');
    });
    expect(fetchFiles).toHaveBeenCalledWith('multilingual');
  });

  it('counts dictation as downloaded only when the model for its language is there', async () => {
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'pl' }]);
    (isWhisperDownloaded as jest.Mock).mockImplementation(
      async (kind: string) => kind === 'english'
    );
    const { result } = renderHook(() => useStartingFeatures());

    await waitFor(() =>
      expect(isWhisperDownloaded).toHaveBeenCalledWith('multilingual')
    );
    expect(dictationFeature(result.current.features).status).toBe('available');
  });
});
