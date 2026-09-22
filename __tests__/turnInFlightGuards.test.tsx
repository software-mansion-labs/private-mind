import React from 'react';
import { render, fireEvent, renderHook } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: { ...require('../styles/colors').lightTheme } }),
}));

jest.mock('expo-sqlite', () => ({ useSQLiteContext: () => ({}) }));

const mockOpenDrawer = jest.fn();
jest.mock('expo-router', () => ({
  useNavigation: () => ({ openDrawer: mockOpenDrawer }),
}));

const mockStart = jest.fn();
jest.mock('../utils/startPhantomChat', () => ({
  startPhantomChat: (...args: unknown[]) => mockStart(...args),
}));

const mockToast = jest.fn();
jest.mock('react-native-toast-message', () => ({
  __esModule: true,
  default: { show: (...args: unknown[]) => mockToast(...args) },
}));

import { useLLMStore } from '../store/llmStore';
import { useTurnInFlight } from '../hooks/useTurnInFlight';
import { TURN_IN_FLIGHT_MESSAGE } from '../utils/turnInFlightNotice';
import DrawerToggleButton from '../components/drawer/DrawerToggleButton';
import NewChatHeaderButton from '../components/NewChatHeaderButton';

const setTurn = (patch: Partial<ReturnType<typeof useLLMStore.getState>>) =>
  useLLMStore.setState({
    isGenerating: false,
    isProcessingPrompt: false,
    generatingForChatId: null,
    activeChatId: null,
    ...patch,
  });

beforeEach(() => {
  jest.clearAllMocks();
  setTurn({});
});

describe('useTurnInFlight', () => {
  it('is false when nothing is running', () => {
    const { result } = renderHook(() => useTurnInFlight());
    expect(result.current).toBe(false);
  });

  it('is true while the chat on screen is generating', () => {
    setTurn({ isGenerating: true, generatingForChatId: 7, activeChatId: 7 });
    const { result } = renderHook(() => useTurnInFlight());
    expect(result.current).toBe(true);
  });

  it('covers the web-search and document phases, not just token generation', () => {
    setTurn({
      isProcessingPrompt: true,
      generatingForChatId: 7,
      activeChatId: 7,
    });
    const { result } = renderHook(() => useTurnInFlight());
    expect(result.current).toBe(true);
  });

  it('does not lock a chat that is not the one generating, so the turn stays reachable', () => {
    setTurn({ isGenerating: true, generatingForChatId: 7, activeChatId: 9 });
    const { result } = renderHook(() => useTurnInFlight());
    expect(result.current).toBe(false);
  });
});

describe('the hamburger while a turn is in flight', () => {
  it('opens the drawer when nothing is running', () => {
    const { getByTestId } = render(<DrawerToggleButton />);
    fireEvent.press(getByTestId('drawer-toggle'));
    expect(mockOpenDrawer).toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('refuses and says why while the answer is being written', () => {
    setTurn({ isGenerating: true, generatingForChatId: 1, activeChatId: 1 });
    const { getByTestId } = render(<DrawerToggleButton />);
    fireEvent.press(getByTestId('drawer-toggle'));
    expect(mockOpenDrawer).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ text1: TURN_IN_FLIGHT_MESSAGE })
    );
  });
});

describe('New chat in the header while a turn is in flight', () => {
  it('starts a chat when nothing is running', () => {
    const { getByTestId } = render(<NewChatHeaderButton />);
    fireEvent.press(getByTestId('new-chat-header-button'));
    expect(mockStart).toHaveBeenCalled();
  });

  it('refuses instead of stranding the turn', () => {
    setTurn({
      isProcessingPrompt: true,
      generatingForChatId: 1,
      activeChatId: 1,
    });
    const { getByTestId } = render(<NewChatHeaderButton />);
    fireEvent.press(getByTestId('new-chat-header-button'));
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ text1: TURN_IN_FLIGHT_MESSAGE })
    );
  });

  it('refuses on the phantom-chat screen too, where it only resets the composer', () => {
    setTurn({ isGenerating: true, generatingForChatId: 1, activeChatId: 1 });
    const before =
      require('../store/chatStore').useChatStore.getState().phantomChatStarts;
    const { getByTestId } = render(<NewChatHeaderButton noOp />);
    fireEvent.press(getByTestId('new-chat-header-button'));
    expect(
      require('../store/chatStore').useChatStore.getState().phantomChatStarts
    ).toBe(before);
  });
});
