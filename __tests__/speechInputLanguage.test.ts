import { Alert, type AlertButton } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import { getLocales } from 'expo-localization';
import { createWhisperSpeechToText } from 'react-native-executorch';
import { ResourceFetcher } from 'react-native-executorch/legacy';
import { ExpoResourceFetcher } from 'react-native-executorch-expo-resource-fetcher/legacy';
import { AudioManager } from 'react-native-audio-api';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { useSettingsStore } from '../store/settingsStore';
import { useSTTStore } from '../store/sttStore';
import {
  downloadedFilenameOf,
  whisperModel,
  whisperSources,
  type SttModelKind,
} from '../utils/sttModelFiles';

jest.mock('../store/modelStore', () => ({
  pauseModelDownloadsWhile: jest.fn(async (work: () => Promise<unknown>) =>
    work()
  ),
}));

const { pauseModelDownloadsWhile } = jest.requireMock('../store/modelStore');

const makeModule = () => ({
  stream: jest.fn(async function* () {
    yield { committed: '', nonCommitted: '' };
  }),
  streamInsert: jest.fn(),
  streamStop: jest.fn(),
  dispose: jest.fn(),
});

const filesOnPhone = (...kinds: SttModelKind[]) =>
  (ExpoResourceFetcher.listDownloadedFiles as jest.Mock).mockResolvedValue(
    kinds.flatMap((kind) =>
      whisperSources(kind).map(
        (source) => `/rne/${downloadedFilenameOf(source)}`
      )
    )
  );

const answerDownloadPrompt = (buttonText: string) =>
  jest
    .spyOn(Alert, 'alert')
    .mockImplementation(
      (_title: string, _message?: string, buttons?: AlertButton[]) => {
        buttons
          ?.find((button) => button.text?.startsWith(buttonText))
          ?.onPress?.();
      }
    );

const startDictation = async () => {
  const { result } = renderHook(() => useSpeechInput());
  let transcript: Awaited<ReturnType<typeof result.current.start>> = null;
  await act(async () => {
    transcript = await result.current.start();
  });
  return transcript;
};

const loadedModelPath = () =>
  (createWhisperSpeechToText as jest.Mock).mock.calls[0][0].modelPath;

let sttModule: ReturnType<typeof makeModule>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  sttModule = makeModule();
  (createWhisperSpeechToText as jest.Mock).mockResolvedValue(sttModule);
  (ResourceFetcher.fetch as jest.Mock).mockImplementation(
    async (_progress: unknown, ...sources: string[]) => sources
  );
  (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'en' }]);
  filesOnPhone('english');
  useSettingsStore.setState({ dictationLanguage: 'phone' });
  useSTTStore.setState({
    module: null,
    moduleKind: null,
    isReady: false,
    isLoading: false,
    loadProgress: 0,
    streamEnd: null,
  });
});

describe('the language a dictation transcribes in', () => {
  it('keeps an English phone on the English model and transcribes English', async () => {
    await startDictation();

    expect(loadedModelPath()).toBe(whisperModel('english').modelPath);
    expect(sttModule.stream).toHaveBeenCalledWith({ language: 'en' });
  });

  it('transcribes the picked language with the multilingual model', async () => {
    filesOnPhone('english', 'multilingual');
    useSettingsStore.setState({ dictationLanguage: 'de' });

    await startDictation();

    expect(loadedModelPath()).toBe(whisperModel('multilingual').modelPath);
    expect(sttModule.stream).toHaveBeenCalledWith({ language: 'de' });
  });

  it('follows a Hindi phone into Hindi', async () => {
    filesOnPhone('multilingual');
    (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'hi' }]);

    await startDictation();

    expect(sttModule.stream).toHaveBeenCalledWith({ language: 'hi' });
  });

  it('downloads the multilingual model on first use with the other downloads held', async () => {
    useSettingsStore.setState({ dictationLanguage: 'pl' });
    answerDownloadPrompt('Download');

    await startDictation();

    expect(pauseModelDownloadsWhile).toHaveBeenCalledTimes(1);
    expect(ResourceFetcher.fetch).toHaveBeenCalledWith(
      expect.any(Function),
      ...whisperSources('multilingual')
    );
    expect(sttModule.stream).toHaveBeenCalledWith({ language: 'pl' });
  });

  it('opens no microphone and loads no model when the download is declined', async () => {
    useSettingsStore.setState({ dictationLanguage: 'pl' });
    answerDownloadPrompt('Cancel');

    const transcript = await startDictation();

    expect(transcript).toBeNull();
    expect(AudioManager.setAudioSessionActivity).not.toHaveBeenCalled();
    expect(createWhisperSpeechToText).not.toHaveBeenCalled();
  });

  it('dictates in English right away when the user chooses English over the download', async () => {
    useSettingsStore.setState({ dictationLanguage: 'pl' });
    answerDownloadPrompt('Use English');

    await startDictation();

    expect(loadedModelPath()).toBe(whisperModel('english').modelPath);
    expect(sttModule.stream).toHaveBeenCalledWith({ language: 'en' });
  });
});
