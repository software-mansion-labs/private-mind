import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../components/CircleButton', () => {
  const { TouchableOpacity } = require('react-native');
  return ({ onPress, testID }: any) => (
    <TouchableOpacity testID={testID || 'circle-btn'} onPress={onPress} />
  );
});

import ChatBarActions from '../components/chat-screen/ChatBarActions';

const defaultProps = {
  userInput: '',
  onSend: jest.fn(),
  isGenerating: false,
  isProcessingPrompt: false,
  onInterrupt: jest.fn(),
  onSpeechInput: jest.fn(),
  thinkingEnabled: false,
  onThinkingToggle: jest.fn(),
  onAttach: jest.fn(),
};

const renderActions = (props = {}) =>
  render(<ChatBarActions {...defaultProps} {...props} />);

beforeEach(() => jest.clearAllMocks());

describe('attach button', () => {
  it('always shows + button regardless of vision model', () => {
    renderActions();
    expect(screen.getByTestId('attach-btn')).toBeTruthy();
  });

  it('calls onAttach when + button is pressed', () => {
    const onAttach = jest.fn();
    renderActions({ onAttach });
    fireEvent.press(screen.getByTestId('attach-btn'));
    expect(onAttach).toHaveBeenCalled();
  });
});

describe('sources button removed', () => {
  it('does not render a Sources button', () => {
    renderActions();
    expect(screen.queryByText('Sources')).toBeNull();
  });
});

describe('thinking toggle', () => {
  it('calls onThinkingToggle when Think button is pressed', () => {
    const onThinkingToggle = jest.fn();
    renderActions({ onThinkingToggle });
    fireEvent.press(screen.getByText('Think'));
    expect(onThinkingToggle).toHaveBeenCalled();
  });
});

describe('action button', () => {
  it('calls onSpeechInput when idle with no input', () => {
    renderActions();
    fireEvent.press(screen.getByTestId('circle-btn'));
    expect(defaultProps.onSpeechInput).toHaveBeenCalled();
  });

  it('calls onSend when there is user input', () => {
    renderActions({ userInput: 'Hello' });
    fireEvent.press(screen.getByTestId('circle-btn'));
    expect(defaultProps.onSend).toHaveBeenCalled();
  });

  it('calls onInterrupt when isGenerating', () => {
    renderActions({ isGenerating: true });
    fireEvent.press(screen.getByTestId('circle-btn'));
    expect(defaultProps.onInterrupt).toHaveBeenCalled();
  });
});
