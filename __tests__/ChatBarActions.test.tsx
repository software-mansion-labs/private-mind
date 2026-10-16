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
  const { Pressable } = require('react-native');
  return ({
    onPress,
    testID,
    busy,
    dimmed,
    disabled,
  }: {
    onPress?: () => void;
    testID?: string;
    busy?: boolean;
    dimmed?: boolean;
    disabled?: boolean;
  }) => (
    <Pressable
      testID={testID || 'circle-btn'}
      onPress={onPress}
      accessibilityState={{ busy: !!busy, disabled: !!disabled }}
      accessibilityHint={dimmed ? 'dimmed' : undefined}
    />
  );
});

jest.mock('../components/chat-screen/ComposerActionButton', () => {
  const { Pressable } = require('react-native');
  return {
    __esModule: true,
    default: ({
      onPress,
      testID,
      busy,
      dimmed,
      disabled,
      action,
    }: {
      onPress?: () => void;
      testID?: string;
      busy?: boolean;
      dimmed?: boolean;
      disabled?: boolean;
      action?: string;
    }) => (
      <Pressable
        testID={testID || 'circle-btn'}
        onPress={onPress}
        accessibilityState={{ busy: !!busy, disabled: !!disabled }}
        accessibilityHint={dimmed ? 'dimmed' : undefined}
        accessibilityValue={{ text: action }}
      />
    ),
  };
});

import ChatBarActions from '../components/chat-screen/ChatBarActions';
import type { SharedValue } from 'react-native-reanimated';
import type { Model } from '../database/modelRepository';

const makeSharedValue = (init: number) => {
  const shared = {
    value: init,
    get: () => shared.value,
    set: (next: number) => {
      shared.value = next;
    },
  };
  return shared;
};

const defaultProps = {
  plusOut: makeSharedValue(0) as unknown as SharedValue<number>,
  userInput: '',
  onSend: jest.fn(),
  isGenerating: false,
  isProcessingPrompt: false,
  onInterrupt: jest.fn(),
  onSpeechInput: jest.fn(),
  onSelectModel: jest.fn(),
  onAttach: jest.fn(),
};

const qwen = { id: 1, modelName: 'Qwen 3 - 1.7B' } as Model;

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

  it('opens the panel while the model is still loading', () => {
    const onAttach = jest.fn();
    renderActions({ onAttach });

    fireEvent.press(screen.getByTestId('attach-btn'));

    expect(onAttach).toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it('takes the send while the model is still loading', () => {
    const onSend = jest.fn();
    renderActions({ onSend, userInput: 'hi' });

    fireEvent.press(screen.getByTestId('send-btn'));

    expect(onSend).toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it('leaves the send button plain while the model loads and nothing was sent (#380)', () => {
    const onSend = jest.fn();
    renderActions({ onSend, userInput: 'hi' });

    const send = screen.getByTestId('send-btn');
    expect(send.props.accessibilityState.busy).toBe(false);
    fireEvent.press(send);
    expect(onSend).toHaveBeenCalled();
  });

  it('spins the send button once a send is waiting on the model (#380)', () => {
    renderActions({ userInput: '', sendPending: true });

    const send = screen.getByTestId('send-btn');
    expect(send.props.accessibilityState.busy).toBe(true);
    expect(send.props.accessibilityState.disabled).toBe(true);
  });

  it('keeps the waiting spinner in place of the mic once the input is cleared', () => {
    renderActions({ userInput: '', sendPending: true });

    expect(screen.queryByTestId('speech-btn')).toBeNull();
  });

  it('keeps the send button live once the model is ready', () => {
    renderActions({ userInput: 'hi' });
    expect(screen.getByTestId('send-btn').props.accessibilityState.busy).toBe(
      false
    );
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

describe('model badge', () => {
  it('shows the selected model name', () => {
    renderActions({ model: qwen });
    expect(screen.getByText('Qwen 3 - 1.7B')).toBeTruthy();
  });

  it('opens the model picker when pressed', () => {
    renderActions({ model: qwen });
    fireEvent.press(screen.getByTestId('composer-model-badge'));
    expect(defaultProps.onSelectModel).toHaveBeenCalled();
  });

  it('does nothing when pressed in an existing chat', () => {
    renderActions({ model: qwen, modelLocked: true });
    fireEvent.press(screen.getByTestId('composer-model-badge'));
    expect(defaultProps.onSelectModel).not.toHaveBeenCalled();
  });

  it('still names the model in an existing chat, without offering a change', () => {
    renderActions({ model: qwen, modelLocked: true });
    expect(screen.getByText('Qwen 3 - 1.7B')).toBeTruthy();
    expect(screen.getByLabelText('Model: Qwen 3 - 1.7B')).toBeTruthy();
    expect(
      screen.getByTestId('composer-model-badge').props.accessibilityState
        .disabled
    ).toBe(true);
  });

  it('names the model being switched to, with a spinner in place of the chevron', () => {
    const gemma = { id: 2, modelName: 'Gemma 4 - 2B' } as Model;
    renderActions({ model: qwen, pendingModel: gemma });

    expect(screen.getByText('Gemma 4 - 2B')).toBeTruthy();
    expect(screen.queryByText('Qwen 3 - 1.7B')).toBeNull();
    expect(screen.getByTestId('composer-model-badge-loader')).toBeTruthy();
  });

  it('cannot be pressed while a model is loading', () => {
    const gemma = { id: 2, modelName: 'Gemma 4 - 2B' } as Model;
    renderActions({ model: qwen, pendingModel: gemma });

    fireEvent.press(screen.getByTestId('composer-model-badge'));

    expect(defaultProps.onSelectModel).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('composer-model-badge').props.accessibilityState.busy
    ).toBe(true);
  });

  it('shows no spinner once the model has settled', () => {
    renderActions({ model: qwen });
    expect(screen.queryByTestId('composer-model-badge-loader')).toBeNull();
  });

  it('is absent without a model', () => {
    renderActions();
    expect(screen.queryByTestId('composer-model-badge')).toBeNull();
  });

  it('replaces the Think and Web toggles', () => {
    renderActions({ model: qwen });
    expect(screen.queryByText('Think')).toBeNull();
    expect(screen.queryByText('Web')).toBeNull();
  });
});

describe('tool chips', () => {
  it('shows no chip while every tool is off', () => {
    renderActions({
      onThinkingToggle: jest.fn(),
      onWebSearchToggle: jest.fn(),
    });

    expect(screen.queryByTestId('tool-chip-think')).toBeNull();
    expect(screen.queryByTestId('tool-chip-web')).toBeNull();
  });

  it('shows an icon-only chip for each tool that is on', () => {
    renderActions({
      thinkingEnabled: true,
      onThinkingToggle: jest.fn(),
      webSearchEnabled: true,
      onWebSearchToggle: jest.fn(),
    });

    expect(screen.getByLabelText('Think is on. Turn off Think')).toBeTruthy();
    expect(
      screen.getByLabelText('Web search is on. Turn off Web search')
    ).toBeTruthy();
    expect(screen.queryByText('Think')).toBeNull();
  });

  it('drops the chip once its tool is turned off', () => {
    const onThinkingToggle = jest.fn();
    const { rerender } = renderActions({
      thinkingEnabled: true,
      onThinkingToggle,
    });
    expect(screen.getByTestId('tool-chip-think')).toBeTruthy();

    rerender(
      <ChatBarActions
        {...defaultProps}
        thinkingEnabled={false}
        onThinkingToggle={onThinkingToggle}
      />
    );

    expect(screen.queryByTestId('tool-chip-think')).toBeNull();
  });

  it('turns Think off from its chip', () => {
    const onThinkingToggle = jest.fn();
    renderActions({ thinkingEnabled: true, onThinkingToggle });

    fireEvent.press(screen.getByTestId('tool-chip-think'));

    expect(onThinkingToggle).toHaveBeenCalledTimes(1);
  });

  it('turns Web search off from its chip', () => {
    const onWebSearchToggle = jest.fn();
    renderActions({ webSearchEnabled: true, onWebSearchToggle });

    fireEvent.press(screen.getByTestId('tool-chip-web'));

    expect(onWebSearchToggle).toHaveBeenCalledTimes(1);
  });

  it('shows no Web search chip when the chat cannot search the web', () => {
    renderActions({ webSearchEnabled: true });

    expect(screen.queryByTestId('tool-chip-web')).toBeNull();
  });
});

describe('action button', () => {
  it('calls onSpeechInput when idle with no input', () => {
    renderActions();
    fireEvent.press(screen.getByTestId('speech-btn'));
    expect(defaultProps.onSpeechInput).toHaveBeenCalled();
  });

  it('keeps the send button in place while an attachment is still being prepared', () => {
    renderActions({ userInput: 'hi', isLoadingAttachment: true });

    expect(screen.getByTestId('send-btn')).toBeTruthy();
    expect(screen.queryByTestId('speech-btn')).toBeNull();
  });

  it('calls onSend when there is user input', () => {
    renderActions({ userInput: 'Hello' });
    fireEvent.press(screen.getByTestId('send-btn'));
    expect(defaultProps.onSend).toHaveBeenCalled();
  });

  it('leaves the stop button live when a send was still pending (#380)', () => {
    renderActions({ isGenerating: true, sendPending: true });

    const stop = screen.getByTestId('stop-btn');
    expect(stop.props.accessibilityState.busy).toBe(false);
    expect(stop.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(stop);
    expect(defaultProps.onInterrupt).toHaveBeenCalled();
  });

  it('calls onInterrupt when isGenerating', () => {
    renderActions({ isGenerating: true });
    fireEvent.press(screen.getByTestId('stop-btn'));
    expect(defaultProps.onInterrupt).toHaveBeenCalled();
  });

  it('never falls back to the microphone between the send and the turn', () => {
    const { rerender } = renderActions({ userInput: 'hi' });
    expect(screen.getByTestId('send-btn')).toBeTruthy();

    rerender(
      <ChatBarActions {...defaultProps} userInput="" sendInFlight={true} />
    );

    expect(screen.queryByTestId('speech-btn')).toBeNull();
    expect(screen.getByTestId('send-btn').props.accessibilityState.busy).toBe(
      false
    );

    rerender(
      <ChatBarActions
        {...defaultProps}
        userInput=""
        sendInFlight={true}
        isProcessingPrompt={true}
      />
    );

    expect(screen.getByTestId('stop-btn')).toBeTruthy();
  });
});
