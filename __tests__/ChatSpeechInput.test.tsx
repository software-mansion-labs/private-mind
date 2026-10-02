import React from 'react';
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import { ActivityIndicator } from 'react-native';
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
  stop: jest.fn(async () => true),
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

  it('spins the send it took and takes no second one while the transcript finishes', () => {
    renderSheet();

    fireEvent.press(screen.getByTestId('speech-send'));
    fireEvent.press(screen.getByTestId('speech-send'));

    expect(mockSpeech.stop).toHaveBeenCalledTimes(1);
    expect(screen.UNSAFE_getAllByType(ActivityIndicator)).toHaveLength(1);
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

describe('ChatSpeechInput once dictation has ended', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpeech.status = 'idle';
  });

  it('no longer claims to be loading speech recognition', async () => {
    renderSheet();
    await act(async () => {});

    expect(screen.queryByText('Loading speech recognition...')).toBeNull();
    expect(screen.queryByText(/Loading\.\.\./)).toBeNull();
  });

  it('answers a send without asking to wait for the model', async () => {
    renderSheet();
    await act(async () => {});

    fireEvent.press(screen.getByTestId('speech-send'));

    expect(Toast.show).not.toHaveBeenCalled();
    expect(mockSpeech.stop).not.toHaveBeenCalled();
  });
});

describe('ChatSpeechInput when the transcript ends without a send', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpeech.status = 'listening';
  });

  const endingStream = (heard: string) => {
    let endStream = () => {};
    mockSpeech.start.mockImplementationOnce(
      async () =>
        (async function* () {
          yield { committed: { text: heard }, nonCommitted: { text: '' } };
          await new Promise<void>((resolve) => {
            endStream = resolve;
          });
        })() as never
    );
    return () => endStream();
  };

  it('closes the sheet and hands over what it heard', async () => {
    const endStream = endingStream('call mom');
    const onInterrupted = jest.fn();
    const onSubmit = jest.fn();
    render(
      <ChatSpeechInput
        onSubmit={onSubmit}
        onCancel={jest.fn()}
        onInterrupted={onInterrupted}
      />
    );
    await screen.findByText('call mom');

    endStream();

    await waitFor(() => expect(onInterrupted).toHaveBeenCalledWith('call mom'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('closes the sheet saying dictation stopped when it heard nothing', async () => {
    const endStream = endingStream('');
    const onCancel = jest.fn();
    render(<ChatSpeechInput onSubmit={jest.fn()} onCancel={onCancel} />);
    await act(async () => {});

    endStream();

    await waitFor(() => expect(onCancel).toHaveBeenCalled());
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: 'Dictation stopped.' })
    );
  });

  it('stays quiet when the trash ended it', async () => {
    const endStream = endingStream('call mom');
    const onInterrupted = jest.fn();
    render(
      <ChatSpeechInput
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
        onInterrupted={onInterrupted}
      />
    );
    await screen.findByText('call mom');

    fireEvent.press(screen.getByTestId('speech-trash'));
    endStream();
    await act(async () => {});

    expect(onInterrupted).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });
});

describe('ChatSpeechInput when the recording cannot be stopped', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpeech.status = 'listening';
  });

  it('stops spinning the send it took', async () => {
    mockSpeech.stop.mockResolvedValueOnce(false);
    renderSheet();

    await act(async () => {
      fireEvent.press(screen.getByTestId('speech-send'));
    });

    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
  });
});

describe('ChatSpeechInput sending what it shows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpeech.status = 'listening';
  });

  it('sends the words still being transcribed along with the finished ones', async () => {
    let endStream = () => {};
    mockSpeech.start.mockImplementationOnce(
      async () =>
        (async function* () {
          yield {
            committed: { text: 'in foreign' },
            nonCommitted: { text: '' },
          };
          yield {
            committed: { text: '' },
            nonCommitted: { text: 'and the rest of it' },
          };
          await new Promise<void>((resolve) => {
            endStream = resolve;
          });
        })() as never
    );
    const onSubmit = jest.fn();
    render(<ChatSpeechInput onSubmit={onSubmit} onCancel={jest.fn()} />);
    await screen.findByText('in foreign and the rest of it');

    fireEvent.press(screen.getByTestId('speech-send'));
    endStream();

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('in foreign and the rest of it')
    );
  });

  it('says no speech was heard instead of closing silently', async () => {
    let endStream = () => {};
    mockSpeech.start.mockImplementationOnce(
      async () =>
        (async function* () {
          await new Promise<void>((resolve) => {
            endStream = resolve;
          });
          yield* [];
        })() as never
    );
    const onCancel = jest.fn();
    render(<ChatSpeechInput onSubmit={jest.fn()} onCancel={onCancel} />);
    await act(async () => {});

    fireEvent.press(screen.getByTestId('speech-send'));
    endStream();

    await waitFor(() => expect(onCancel).toHaveBeenCalled());
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: 'No speech was heard.' })
    );
  });
});

describe('ChatSpeechInput when the app goes to the background', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSpeech.status = 'listening';
  });

  it('stops listening and hands over what it heard instead of staying stuck on a dead microphone (C-74)', async () => {
    const { AppState } = require('react-native');
    let reportState: ((state: string) => void) | undefined;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: unknown, handler: unknown) => {
        reportState = handler as (state: string) => void;
        return { remove: jest.fn() };
      });
    mockSpeech.start.mockImplementationOnce(
      async () =>
        (async function* () {
          yield {
            committed: { text: 'remind me to' },
            nonCommitted: { text: 'buy milk' },
          };
          await new Promise<void>(() => {});
        })() as never
    );
    const onInterrupted = jest.fn();
    const onSubmit = jest.fn();
    render(
      <ChatSpeechInput
        onSubmit={onSubmit}
        onCancel={jest.fn()}
        onInterrupted={onInterrupted}
      />
    );
    await screen.findByText('remind me to buy milk');

    act(() => reportState?.('background'));

    expect(mockSpeech.abandon).toHaveBeenCalled();
    expect(onInterrupted).toHaveBeenCalledWith('remind me to buy milk');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('lets a send already on its way finish and go out', async () => {
    const { AppState } = require('react-native');
    let reportState: ((state: string) => void) | undefined;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event: unknown, handler: unknown) => {
        reportState = handler as (state: string) => void;
        return { remove: jest.fn() };
      });
    let endStream = () => {};
    mockSpeech.start.mockImplementationOnce(
      async () =>
        (async function* () {
          yield {
            committed: { text: 'remind me to' },
            nonCommitted: { text: 'buy milk' },
          };
          await new Promise<void>((resolve) => {
            endStream = resolve;
          });
        })() as never
    );
    const onInterrupted = jest.fn();
    const onSubmit = jest.fn();
    render(
      <ChatSpeechInput
        onSubmit={onSubmit}
        onCancel={jest.fn()}
        onInterrupted={onInterrupted}
      />
    );
    await screen.findByText('remind me to buy milk');

    fireEvent.press(screen.getByTestId('speech-send'));
    act(() => reportState?.('background'));
    endStream();

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith('remind me to buy milk')
    );
    expect(mockSpeech.abandon).not.toHaveBeenCalled();
    expect(onInterrupted).not.toHaveBeenCalled();
  });
});
