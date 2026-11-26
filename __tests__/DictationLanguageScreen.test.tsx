import React from 'react';
import { Alert, type AlertButton } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { getLocales } from 'expo-localization';
import DictationLanguageScreen from '../app/(modals)/settings/dictation-language';
import { useSettingsStore } from '../store/settingsStore';
import { useSTTStore } from '../store/sttStore';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('react-native-gesture-handler', () => {
  const { Pressable, ScrollView } = require('react-native');
  return { Pressable, ScrollView };
});

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../components/GlassScreenHeader', () => {
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, onBack }: { title: string; onBack: () => void }) => (
      <Pressable onPress={onBack} testID="header-back">
        <Text>{title}</Text>
      </Pressable>
    ),
    useGlassScreenHeaderHeight: () => 0,
  };
});

jest.mock('../utils/Feedback', () => ({
  Feedback: {
    toggleOn: jest.fn(),
    toggleOff: jest.fn(),
    destructive: jest.fn(),
  },
}));

const refreshOnDisk = jest.fn(async () => ({
  english: true,
  multilingual: false,
}));
const fetchFiles = jest.fn(async () => true);
const cancelFetchFiles = jest.fn(async () => undefined);
const deleteModelFiles = jest.fn(async () => undefined);
const releaseModelOtherThan = jest.fn();

const pressAlertButton = (buttonText: string) =>
  jest
    .spyOn(Alert, 'alert')
    .mockImplementation(
      (_title: string, _message?: string, buttons?: AlertButton[]) => {
        buttons
          ?.find((button) => button.text?.startsWith(buttonText))
          ?.onPress?.();
      }
    );

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  (getLocales as jest.Mock).mockReturnValue([{ languageCode: 'pl' }]);
  useSettingsStore.setState({ dictationLanguage: 'en' });
  useSTTStore.setState({
    module: null,
    moduleKind: null,
    fetchingKind: null,
    filesProgress: 0,
    onDisk: { english: true, multilingual: false },
    refreshOnDisk,
    fetchFiles,
    cancelFetchFiles,
    deleteModelFiles,
    releaseModelOtherThan,
  });
});

describe('the dictation language page', () => {
  it('offers the phone language, naming what it resolves to', () => {
    render(<DictationLanguageScreen />);

    expect(screen.getByTestId('dictation-language-phone')).toHaveTextContent(
      'Phone languagePolish'
    );
    expect(screen.getByTestId('dictation-language-en-check')).toBeTruthy();
  });

  it('states the multilingual download size before anything is downloaded', () => {
    render(<DictationLanguageScreen />);

    expect(
      screen.getByText(/multilingual model, a one-time \d+ MB download/)
    ).toBeTruthy();
    expect(
      screen.getByTestId('dictation-model-multilingual-status')
    ).toHaveTextContent(/^Not downloaded · \d+ MB$/);
  });

  it('downloads the multilingual model once the user agrees to pick German', async () => {
    pressAlertButton('Download');
    render(<DictationLanguageScreen />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('dictation-language-de'));
    });

    expect(useSettingsStore.getState().dictationLanguage).toBe('de');
    expect(fetchFiles).toHaveBeenCalledWith('multilingual');
  });

  it('narrows the list to the languages matching the search', () => {
    render(<DictationLanguageScreen />);

    fireEvent.changeText(
      screen.getByTestId('dictation-language-search'),
      'urd'
    );

    expect(screen.getByTestId('dictation-language-ur')).toBeTruthy();
    expect(screen.queryByTestId('dictation-language-de')).toBeNull();
  });

  it('shows the models on the phone and checks them when it opens', async () => {
    render(<DictationLanguageScreen />);

    await waitFor(() => expect(refreshOnDisk).toHaveBeenCalled());
    expect(
      screen.getByTestId('dictation-model-english-status')
    ).toHaveTextContent(/^On this device · \d+ MB$/);
  });

  it('deletes a model only after the user confirms', async () => {
    pressAlertButton('Delete');
    render(<DictationLanguageScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('Delete'));
    });

    expect(deleteModelFiles).toHaveBeenCalledWith('english');
  });

  it('keeps the model when the delete is cancelled', async () => {
    pressAlertButton('Cancel');
    render(<DictationLanguageScreen />);

    await act(async () => {
      fireEvent.press(screen.getByText('Delete'));
    });

    expect(deleteModelFiles).not.toHaveBeenCalled();
  });

  it('shows a running download with a way to stop it', async () => {
    useSTTStore.setState({ fetchingKind: 'multilingual', filesProgress: 0.42 });
    render(<DictationLanguageScreen />);

    expect(
      screen.getByTestId('dictation-model-multilingual-status')
    ).toHaveTextContent('Downloading 42%');
    await act(async () => {
      fireEvent.press(screen.getByText('Cancel'));
    });
    expect(cancelFetchFiles).toHaveBeenCalled();
  });
});
