import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ContextSizeScreen from '../app/(modals)/settings/context-size';
import { useSettingsStore } from '../store/settingsStore';
import { useLLMStore } from '../store/llmStore';
import { useModelStore } from '../store/modelStore';
import type { Model } from '../database/modelRepository';

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

jest.mock('../hooks/useLastUsedModel', () => ({
  useLastUsedModel: () => null,
}));

jest.mock('../utils/Feedback', () => ({
  Feedback: { toggleOn: jest.fn(), toggleOff: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ conversationMemory: 'auto' });
  useLLMStore.setState({
    model: null,
    isGenerating: false,
    isProcessingPrompt: false,
  });
  useModelStore.setState({ downloadedModels: [] });
});

const downloaded = {
  id: 11,
  modelName: 'LFM 3 - 1.7B',
  source: 'remote',
  isDownloaded: true,
  modelPath: '/models/lfm3.pte',
  tokenizerPath: '/models/tokenizer.json',
  tokenizerConfigPath: '/models/tokenizer_config.json',
} as Model;

describe('the Context size page', () => {
  it('lists the four sizes under the Context size title', () => {
    render(<ContextSizeScreen />);
    expect(screen.getByText('Context size')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('stores the size that was picked', () => {
    render(<ContextSizeScreen />);
    fireEvent.press(screen.getByTestId('context-size-low'));
    expect(useSettingsStore.getState().conversationMemory).toBe('low');
  });

  it('goes back from the header', () => {
    render(<ContextSizeScreen />);
    fireEvent.press(screen.getByTestId('header-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('holds the choice while an answer is being generated', () => {
    useLLMStore.setState({ isGenerating: true });
    render(<ContextSizeScreen />);
    fireEvent.press(screen.getByTestId('context-size-low'));
    expect(useSettingsStore.getState().conversationMemory).toBe('auto');
  });

  it('holds the choice while the prompt for an answer is being prepared', () => {
    useLLMStore.setState({ isProcessingPrompt: true });
    render(<ContextSizeScreen />);
    fireEvent.press(screen.getByTestId('context-size-low'));
    expect(useSettingsStore.getState().conversationMemory).toBe('auto');
  });

  it('shows sizes for a downloaded model when no chat has used one yet', () => {
    useModelStore.setState({ downloadedModels: [downloaded] });
    render(<ContextSizeScreen />);
    expect(screen.getByTestId('context-size-low')).toHaveTextContent(/2k/);
  });

  it('shows no sizes when there is no model at all', () => {
    render(<ContextSizeScreen />);
    expect(screen.getByTestId('context-size-low')).not.toHaveTextContent(/2k/);
  });
});
