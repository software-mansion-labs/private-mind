import { Alert, type AlertButton } from 'react-native';
import { getLocales } from 'expo-localization';
import {
  chooseDictationLanguage,
  pickDictationLanguage,
} from '../utils/chooseDictationLanguage';
import { useSettingsStore } from '../store/settingsStore';
import { useSTTStore } from '../store/sttStore';
import { isWhisperDownloaded } from '../utils/sttModelFiles';

jest.mock('../utils/sttModelFiles', () => ({
  ...jest.requireActual('../utils/sttModelFiles'),
  isWhisperDownloaded: jest.fn(async () => false),
}));

const mockGetLocales = getLocales as jest.Mock;
const mockIsDownloaded = isWhisperDownloaded as jest.Mock;

let alertSpy: jest.SpyInstance;

const answerAlertWith = (buttonText: string) =>
  alertSpy.mockImplementation(
    (_title: string, _message?: string, buttons?: AlertButton[]) => {
      buttons
        ?.find((button) => button.text?.startsWith(buttonText))
        ?.onPress?.();
    }
  );

const alertButtons = () =>
  (alertSpy.mock.calls[0][2] as AlertButton[]).map((button) => button.text);

const fetchFiles = jest.fn(async () => true);
const releaseModelOtherThan = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockGetLocales.mockReturnValue([{ languageCode: 'pl' }]);
  mockIsDownloaded.mockResolvedValue(false);
  useSettingsStore.setState({ dictationLanguage: 'phone' });
  useSTTStore.setState({
    moduleKind: null,
    fetchingKind: null,
    fetchFiles,
    releaseModelOtherThan,
  });
});

describe('the language a dictation starts in', () => {
  it('starts English dictation without asking anything', async () => {
    useSettingsStore.setState({ dictationLanguage: 'en' });

    expect(await chooseDictationLanguage()).toBe('en');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('follows a Polish phone into Polish once the multilingual model is on the phone', async () => {
    mockIsDownloaded.mockResolvedValue(true);

    expect(await chooseDictationLanguage()).toBe('pl');
    expect(mockIsDownloaded).toHaveBeenCalledWith('multilingual');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('asks before the multilingual download and states its size', async () => {
    answerAlertWith('Download');

    expect(await chooseDictationLanguage()).toBe('pl');
    const [title, message] = alertSpy.mock.calls[0];
    expect(title).toBe('Dictate in Polish?');
    expect(message).toMatch(/\d+ MB download/);
    expect(alertButtons()).toEqual([
      'Use English',
      'Cancel',
      expect.stringMatching(/^Download \d+ MB$/),
    ]);
  });

  it('switches to English for good when the user would rather not download', async () => {
    answerAlertWith('Use English');

    expect(await chooseDictationLanguage()).toBe('en');
    expect(useSettingsStore.getState().dictationLanguage).toBe('en');
  });

  it('starts nothing when the user cancels', async () => {
    answerAlertWith('Cancel');

    expect(await chooseDictationLanguage()).toBeNull();
    expect(useSettingsStore.getState().dictationLanguage).toBe('phone');
  });

  it('does not ask again while the multilingual model is already downloading', async () => {
    useSTTStore.setState({ fetchingKind: 'multilingual' });

    expect(await chooseDictationLanguage()).toBe('pl');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('uses a picked language over the phone language', async () => {
    mockIsDownloaded.mockResolvedValue(true);
    useSettingsStore.setState({ dictationLanguage: 'hi' });

    expect(await chooseDictationLanguage()).toBe('hi');
  });
});

describe('picking a dictation language in settings', () => {
  it('downloads the multilingual model only after the user agrees to its size', async () => {
    answerAlertWith('Download');

    expect(await pickDictationLanguage('de')).toBe(true);

    expect(alertButtons()).toEqual([
      'Cancel',
      expect.stringMatching(/^Download \d+ MB$/),
    ]);
    expect(useSettingsStore.getState().dictationLanguage).toBe('de');
    expect(fetchFiles).toHaveBeenCalledWith('multilingual');
    expect(releaseModelOtherThan).toHaveBeenCalledWith('multilingual');
  });

  it('keeps the previous language when the download is declined', async () => {
    useSettingsStore.setState({ dictationLanguage: 'en' });
    answerAlertWith('Cancel');

    expect(await pickDictationLanguage('de')).toBe(false);

    expect(useSettingsStore.getState().dictationLanguage).toBe('en');
    expect(fetchFiles).not.toHaveBeenCalled();
  });

  it('switches between other languages without downloading again', async () => {
    mockIsDownloaded.mockResolvedValue(true);

    expect(await pickDictationLanguage('ur')).toBe(true);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(fetchFiles).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().dictationLanguage).toBe('ur');
  });

  it('frees the multilingual model when the user goes back to English', async () => {
    useSettingsStore.setState({ dictationLanguage: 'pl' });

    expect(await pickDictationLanguage('en')).toBe(true);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(releaseModelOtherThan).toHaveBeenCalledWith('english');
    expect(useSettingsStore.getState().dictationLanguage).toBe('en');
  });

  it('resolves the phone language before deciding on a download', async () => {
    useSettingsStore.setState({ dictationLanguage: 'en' });
    mockGetLocales.mockReturnValue([{ languageCode: 'en' }]);

    expect(await pickDictationLanguage('phone')).toBe(true);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().dictationLanguage).toBe('phone');
  });
});
