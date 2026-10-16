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

import NewChatHeaderButton from '../components/NewChatHeaderButton';
import { useChatStore } from '../store/chatStore';

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
});
