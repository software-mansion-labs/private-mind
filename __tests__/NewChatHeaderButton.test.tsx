import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: { ...require('../styles/colors').lightTheme },
  }),
}));

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => ({}),
}));

const mockStart = jest.fn();
jest.mock('../utils/startPhantomChat', () => ({
  startPhantomChat: (...args: unknown[]) => mockStart(...args),
}));

jest.mock('../utils/Feedback', () => ({
  Feedback: { newChat: jest.fn() },
}));

import NewChatHeaderButton from '../components/NewChatHeaderButton';
import { useChatStore } from '../store/chatStore';
import { Feedback } from '../utils/Feedback';

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

describe('NewChatHeaderButton', () => {
  it('renders a Touchable', () => {
    const { getByTestId } = render(<NewChatHeaderButton />);
    expect(getByTestId('new-chat-header-button')).toBeTruthy();
  });

  it('starts a phantom chat when noOp is not set', () => {
    const { getByTestId } = render(<NewChatHeaderButton />);
    fireEvent.press(getByTestId('new-chat-header-button'));
    expect(mockStart).toHaveBeenCalled();
  });

  it('navigates nowhere when noOp=true, because that screen is already a new chat', () => {
    const { getByTestId } = render(<NewChatHeaderButton noOp={true} />);
    fireEvent.press(getByTestId('new-chat-header-button'));
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('still asks for a fresh blank chat when noOp=true, so a tapped suggestion can be taken back', () => {
    const before = useChatStore.getState().phantomChatStarts;
    const { getByTestId } = render(<NewChatHeaderButton noOp={true} />);
    fireEvent.press(getByTestId('new-chat-header-button'));
    expect(useChatStore.getState().phantomChatStarts).toBe(before + 1);
  });

  it('taps back like the rest of the chat controls, on either screen', () => {
    const { getByTestId, rerender } = render(<NewChatHeaderButton />);
    fireEvent.press(getByTestId('new-chat-header-button'));
    rerender(<NewChatHeaderButton noOp={true} />);
    fireEvent.press(getByTestId('new-chat-header-button'));
    expect(Feedback.newChat).toHaveBeenCalledTimes(2);
  });
});
