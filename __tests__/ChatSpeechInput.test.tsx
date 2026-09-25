import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import Toast from 'react-native-toast-message';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../components/chat-screen/RecordingAnimation', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => <View />,
  };
});

const mockSpeech = {
  loadProgress: 0.4,
  status: 'loading' as 'loading' | 'listening' | 'processing' | 'idle',
  start: jest.fn(async () => null),
  stop: jest.fn(),
  abandon: jest.fn(),
};

jest.mock('../hooks/useSpeechInput', () => ({
  useSpeechInput: () => mockSpeech,
}));

import ChatSpeechInput from '../components/chat-screen/ChatSpeechInput';

const renderSheet = () =>
  render(<ChatSpeechInput onSubmit={jest.fn()} onCancel={jest.fn()} />);

describe('ChatSpeechInput while the model is still loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpeech.status = 'loading';
  });

  it('says what it is waiting for instead of offering a send', () => {
    renderSheet();

    expect(screen.getByText('Loading speech recognition...')).toBeTruthy();
  });

  it('answers a send with an explanation rather than silence', () => {
    renderSheet();

    fireEvent.press(screen.getByTestId('speech-send'));

    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        text1: 'Still loading speech recognition, one moment.',
      })
    );
    expect(mockSpeech.stop).not.toHaveBeenCalled();
  });
});

describe('ChatSpeechInput once it is listening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpeech.status = 'listening';
  });

  it('offers the send', () => {
    renderSheet();

    expect(screen.getByText('Click again to send')).toBeTruthy();
  });

  it('stops the recording on send', () => {
    renderSheet();

    fireEvent.press(screen.getByTestId('speech-send'));

    expect(mockSpeech.stop).toHaveBeenCalledTimes(1);
    expect(Toast.show).not.toHaveBeenCalled();
  });
});

describe('ChatSpeechInput while the transcript finishes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpeech.status = 'processing';
  });

  it('says the transcript is still coming', () => {
    renderSheet();

    expect(screen.getByText('Finishing the transcript...')).toBeTruthy();
  });

  it('takes no second send', () => {
    renderSheet();

    fireEvent.press(screen.getByTestId('speech-send'));

    expect(mockSpeech.stop).not.toHaveBeenCalled();
  });
});
