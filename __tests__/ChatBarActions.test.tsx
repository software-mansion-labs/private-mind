import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';

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
  return ({ onPress, testID }: { onPress?: () => void; testID?: string }) => (
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

  it.each([{ isGenerating: true }, { isProcessingPrompt: true }])(
    'greys out attachments and explains why they cannot be opened while responding',
    (state) => {
      const onAttach = jest.fn();
      renderActions({ ...state, onAttach });

      expect(
        StyleSheet.flatten(
          screen.getByTestId('attach-btn-container').props.style
        )
      ).toEqual(expect.objectContaining({ opacity: 0.4 }));

      fireEvent.press(screen.getByTestId('attach-btn'));

      expect(onAttach).not.toHaveBeenCalled();
      expect(Toast.show).toHaveBeenCalledWith({
        type: 'defaultToast',
        text1: 'Wait for the response to finish or stop it first.',
      });
    }
  );

  it('greys out attachments and explains why while a document is still indexing', () => {
    const onAttach = jest.fn();
    renderActions({ isLoadingAttachment: true, onAttach });

    expect(
      StyleSheet.flatten(screen.getByTestId('attach-btn-container').props.style)
    ).toEqual(expect.objectContaining({ opacity: 0.4 }));

    fireEvent.press(screen.getByTestId('attach-btn'));

    expect(onAttach).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith({
      type: 'defaultToast',
      text1: 'Wait for the document to finish processing.',
    });
  });

  it('prefers the response message when generating over an indexing document', () => {
    renderActions({ isLoadingAttachment: true, isGenerating: true });

    fireEvent.press(screen.getByTestId('attach-btn'));

    expect(Toast.show).toHaveBeenCalledWith({
      type: 'defaultToast',
      text1: 'Wait for the response to finish or stop it first.',
    });
  });

  it('blocks attachments while disabled without greying out or explaining', () => {
    const onAttach = jest.fn();
    renderActions({ onAttach, disabled: true });

    fireEvent.press(screen.getByTestId('attach-btn'));

    expect(onAttach).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
    expect(
      StyleSheet.flatten(screen.getByTestId('attach-btn-container').props.style)
    ).toBeUndefined();
  });

  it('keeps the attachment button at full opacity when idle', () => {
    renderActions();

    expect(
      StyleSheet.flatten(screen.getByTestId('attach-btn-container').props.style)
    ).toBeUndefined();
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
