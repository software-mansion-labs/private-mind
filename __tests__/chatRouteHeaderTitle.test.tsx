import React from 'react';
import { act, render } from '@testing-library/react-native';
import type { Chat, Message } from '../database/chatRepository';

const mockParams: Record<string, string> = { id: '5' };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));

const mockHeader: { hideTitle?: boolean } = {};
jest.mock('../hooks/useChatHeader', () => ({
  __esModule: true,
  default: ({ hideTitle }: { hideTitle: boolean }) => {
    mockHeader.hideTitle = hideTitle;
    return { MenuElements: null, titleBottom: 0 };
  },
}));

jest.mock('../hooks/useChatBackGuard', () => ({
  useChatBackGuard: jest.fn(),
}));

jest.mock('../components/chat-screen/ChatScreen', () => ({
  __esModule: true,
  default: () => null,
}));

import ChatRoute from '../app/(drawer)/chat/[id]';
import { useChatStore } from '../store/chatStore';
import { useLLMStore } from '../store/llmStore';

const savedChat: Chat = { id: 5, modelId: 1, title: 'Trip', lastUsed: 0 };
const openChat = () =>
  useLLMStore.setState({
    activeChatId: savedChat.id,
    activeChatMessages: [{ id: 1 } as Message],
  });

describe('the chat title in the header', () => {
  beforeEach(() =>
    useChatStore.setState({ chats: [savedChat], phantomChat: null })
  );

  it('shows while a saved chat has messages', () => {
    openChat();
    render(<ChatRoute />);

    expect(mockHeader.hideTitle).toBe(false);
  });

  it('hides as the messages clear for a new chat, not after the screen is replaced', () => {
    openChat();
    render(<ChatRoute />);

    act(() =>
      useLLMStore.setState({ activeChatId: null, activeChatMessages: [] })
    );

    expect(mockHeader.hideTitle).toBe(true);
  });
});
