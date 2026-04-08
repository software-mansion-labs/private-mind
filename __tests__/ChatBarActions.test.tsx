import React from 'react';
import { TouchableOpacity } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

// Render CircleButton as a simple button with a known testID derived from its onPress target
jest.mock('../components/CircleButton', () => {
  const { TouchableOpacity } = require('react-native');
  // Expose onPress so tests can trigger it
  return ({ onPress, disabled }: any) => (
    <TouchableOpacity
      testID="circle-btn"
      onPress={onPress}
      disabled={disabled}
    />
  );
});

import ChatBarActions from '../components/chat-screen/ChatBarActions';

const defaultProps = {
  onSelectSource: jest.fn(),
  activeSourcesCount: 0,
  userInput: '',
  onSend: jest.fn(),
  isGenerating: false,
  isProcessingPrompt: false,
  onInterrupt: jest.fn(),
  onSpeechInput: jest.fn(),
  thinkingEnabled: false,
  onThinkingToggle: jest.fn(),
};

const renderActions = (props = {}) =>
  render(<ChatBarActions {...defaultProps} {...props} />);

// Helper: press the single CircleButton (the action button on the right)
const pressActionBtn = (getByTestId: typeof screen.getByTestId) =>
  fireEvent.press(getByTestId('circle-btn'));

beforeEach(() => jest.clearAllMocks());

// ─── action button logic ───────────────────────────────────────────────────────

describe('action button', () => {
  it('calls onSpeechInput when idle with no input', () => {
    renderActions({
      userInput: '',
      isGenerating: false,
      isProcessingPrompt: false,
    });
    pressActionBtn(screen.getByTestId);
    expect(defaultProps.onSpeechInput).toHaveBeenCalled();
  });

  it('calls onSend when there is user input', () => {
    renderActions({ userInput: 'Hello' });
    pressActionBtn(screen.getByTestId);
    expect(defaultProps.onSend).toHaveBeenCalled();
  });

  it('calls onInterrupt when isGenerating', () => {
    renderActions({ isGenerating: true });
    pressActionBtn(screen.getByTestId);
    expect(defaultProps.onInterrupt).toHaveBeenCalled();
  });

  it('calls onInterrupt when isProcessingPrompt', () => {
    renderActions({ isProcessingPrompt: true });
    pressActionBtn(screen.getByTestId);
    expect(defaultProps.onInterrupt).toHaveBeenCalled();
  });

  it('interrupt takes priority over user input when generating', () => {
    renderActions({ isGenerating: true, userInput: 'Hello' });
    pressActionBtn(screen.getByTestId);
    expect(defaultProps.onInterrupt).toHaveBeenCalled();
    expect(defaultProps.onSend).not.toHaveBeenCalled();
  });
});

// ─── sources button ───────────────────────────────────────────────────────────

describe('sources button', () => {
  it('shows "Sources" label', () => {
    renderActions();
    expect(screen.getByText('Sources')).toBeTruthy();
  });

  it('calls onSelectSource when pressed', () => {
    const onSelectSource = jest.fn();
    renderActions({ onSelectSource });
    fireEvent.press(screen.getByText('Sources'));
    expect(onSelectSource).toHaveBeenCalled();
  });

  it('shows count badge when activeSourcesCount > 0', () => {
    renderActions({ activeSourcesCount: 3 });
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('does not show count badge when activeSourcesCount is 0', () => {
    renderActions({ activeSourcesCount: 0 });
    expect(screen.queryByText('0')).toBeNull();
  });
});

// ─── thinking toggle ──────────────────────────────────────────────────────────

describe('thinking toggle', () => {
  it('calls onThinkingToggle when Think button is pressed', () => {
    const onThinkingToggle = jest.fn();
    renderActions({ onThinkingToggle });
    fireEvent.press(screen.getByText('Think'));
    expect(onThinkingToggle).toHaveBeenCalled();
  });

  it('shows Think label in both enabled and disabled states', () => {
    const { unmount } = renderActions({ thinkingEnabled: true });
    expect(screen.getByText('Think')).toBeTruthy();
    unmount();
    renderActions({ thinkingEnabled: false });
    expect(screen.getByText('Think')).toBeTruthy();
  });
});
