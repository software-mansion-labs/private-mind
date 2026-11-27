import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import CustomSystemPromptScreen from '../app/(modals)/settings/custom-system-prompt';
import { useSettingsStore } from '../store/settingsStore';
import { MAX_CUSTOM_SYSTEM_PROMPT_LENGTH } from '../constants/settings';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));
jest.mock('../components/GlassScreenHeader', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title }: { title: string }) => <Text>{title}</Text>,
    useGlassScreenHeaderHeight: () => 0,
  };
});
jest.mock('../components/CustomKeyboardAvoidingView', () => {
  const { View } = require('react-native');
  return { CustomKeyboardAvoidingView: View };
});
jest.mock('../utils/Feedback', () => ({
  Feedback: { editSave: jest.fn() },
}));
jest.mock('react-native-gesture-handler', () => {
  const { ScrollView } = require('react-native');
  return { ScrollView };
});
jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

const pressSave = () => fireEvent.press(screen.getByText('Save'));

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ customSystemPrompt: '', hasHydrated: true });
});

describe('the custom instructions screen', () => {
  it('counts the characters against the limit', () => {
    render(<CustomSystemPromptScreen />);
    fireEvent.changeText(
      screen.getByTestId('custom-instructions-input'),
      'Be brief.'
    );
    expect(
      screen.getByText(`9/${MAX_CUSTOM_SYSTEM_PROMPT_LENGTH}`)
    ).toBeTruthy();
  });

  it('saves the trimmed instructions and goes back', () => {
    render(<CustomSystemPromptScreen />);
    fireEvent.changeText(
      screen.getByTestId('custom-instructions-input'),
      '  Be brief.  '
    );
    pressSave();
    expect(useSettingsStore.getState().customSystemPrompt).toBe('Be brief.');
    expect(mockBack).toHaveBeenCalled();
  });

  it('refuses to save instructions over the limit', () => {
    render(<CustomSystemPromptScreen />);
    fireEvent.changeText(
      screen.getByTestId('custom-instructions-input'),
      'a'.repeat(MAX_CUSTOM_SYSTEM_PROMPT_LENGTH + 1)
    );
    expect(screen.getByText(/too long/)).toBeTruthy();
    pressSave();
    expect(useSettingsStore.getState().customSystemPrompt).toBe('');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
