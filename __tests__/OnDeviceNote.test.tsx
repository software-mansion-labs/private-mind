import React from 'react';
import { render } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { Message } from '../database/chatRepository';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('../components/chat-screen/MessageItem', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../components/chat-screen/SourcesSheet', () => {
  const { forwardRef } = require('react');
  const SourcesSheet = forwardRef(() => null);
  SourcesSheet.displayName = 'SourcesSheet';
  return { __esModule: true, default: SourcesSheet };
});

import Messages from '../components/chat-screen/Messages';
import {
  LEARN_MORE,
  ON_DEVICE_NOTE,
} from '../components/chat-screen/OnDeviceNote';

const message = (id: number): Message =>
  ({
    id,
    chatId: 1,
    role: id % 2 ? 'user' : 'assistant',
    content: `message ${id}`,
  }) as Message;

const history = (count: number) =>
  Array.from({ length: count }, (_, i) => message(i + 1));

const renderMessages = (chatHistory: Message[]) =>
  render(
    <Messages
      chatHistory={chatHistory}
      extraContentPadding={{ value: 0 } as SharedValue<number>}
      isGenerating={false}
      turnInFlight={false}
      bottomOffset={0}
      chatBarInset={0}
      topInset={0}
    />
  );

describe('the on-device note', () => {
  it('shows at the top of a chat', () => {
    const { getByTestId } = renderMessages(history(2));

    expect(getByTestId('on-device-note')).toBeTruthy();
  });

  it('says the chat stays on the phone', () => {
    const { getByText } = renderMessages(history(2));

    expect(getByText(`${ON_DEVICE_NOTE} ${LEARN_MORE}`)).toBeTruthy();
  });

  it('waits until a long chat is scrolled back to its first message', () => {
    const { queryByTestId } = renderMessages(history(60));

    expect(queryByTestId('on-device-note')).toBeNull();
  });

  it('stays away from a chat with no messages', () => {
    const { queryByTestId } = renderMessages([]);

    expect(queryByTestId('on-device-note')).toBeNull();
  });
});
