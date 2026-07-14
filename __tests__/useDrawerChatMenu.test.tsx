import React from 'react';
import {
  render,
  screen,
  fireEvent,
  renderHook,
  act,
  waitFor,
} from '@testing-library/react-native';
import { Platform, ActionSheetIOS, Alert } from 'react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: jest.fn(() => ({})),
}));

const mockRenameChat = jest.fn();
const mockDeleteChat = jest.fn();
jest.mock('../store/chatStore', () => ({
  useChatStore: jest.fn(() => ({
    renameChat: mockRenameChat,
    deleteChat: mockDeleteChat,
  })),
}));

jest.mock('../context/VectorStoreContext', () => ({
  useVectorStore: jest.fn(() => ({ vectorStore: null })),
}));

const mockExportChatRoom = jest.fn();
jest.mock('../database/exportImportRepository', () => ({
  exportChatRoom: (...args: unknown[]) => mockExportChatRoom(...args),
}));

const mockReplace = jest.fn();
let mockPathname = '/';
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  usePathname: () => mockPathname,
}));

import { useDrawerChatMenu } from '../components/drawer/useDrawerChatMenu';

const chat = { id: 7, modelId: 1, title: 'Trip to Rome', lastUsed: Date.now() };
const untitledChat = { id: 9, modelId: 1, title: '', lastUsed: Date.now() };

const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

const captureSheet = () => {
  let callback: ((index: number) => void) | null = null;
  jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation((_options, cb) => {
      callback = cb;
    });
  return () => callback!;
};

const captureDeleteConfirm = () => {
  let onPress: (() => Promise<void>) | undefined;
  jest.spyOn(Alert, 'alert').mockImplementation((...args: unknown[]) => {
    const buttons = args[2] as {
      text: string;
      onPress?: () => Promise<void>;
    }[];
    onPress = buttons?.find((button) => button.text === 'Delete')?.onPress;
  });
  return () => onPress;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockPathname = '/';
  setPlatform('ios');
  mockRenameChat.mockResolvedValue(undefined);
  mockDeleteChat.mockResolvedValue(undefined);
  mockExportChatRoom.mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('opening the menu', () => {
  it('offers rename, export and delete for the long-pressed chat', () => {
    const spy = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => {});
    const { result } = renderHook(() => useDrawerChatMenu());

    act(() => result.current.openMenuFor(chat));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: ['Rename', 'Export Chat', 'Delete Chat', 'Cancel'],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 3,
      }),
      expect.any(Function)
    );
  });

  it('names the chat it was opened for', () => {
    const spy = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => {});
    const { result } = renderHook(() => useDrawerChatMenu());

    act(() => result.current.openMenuFor(chat));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Trip to Rome' }),
      expect.any(Function)
    );
  });

  it('shortens a long chat title so the menu header stays on one line', () => {
    const spy = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => {});
    const longChat = { ...chat, title: 'a'.repeat(40) };
    const { result } = renderHook(() => useDrawerChatMenu());

    act(() => result.current.openMenuFor(longChat));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ title: `${'a'.repeat(32)}…` }),
      expect.any(Function)
    );
  });

  it('names an untitled chat by its id', () => {
    const spy = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => {});
    const { result } = renderHook(() => useDrawerChatMenu());

    act(() => result.current.openMenuFor(untitledChat));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Chat 9' }),
      expect.any(Function)
    );
  });

  it('reports the menu as active so a blur behind it is ignored', () => {
    jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => {});
    const onMenuActiveChange = jest.fn();
    const { result } = renderHook(() =>
      useDrawerChatMenu({ onMenuActiveChange })
    );

    act(() => result.current.openMenuFor(chat));

    expect(onMenuActiveChange).toHaveBeenCalledWith(true);
  });

  it('reports the menu as inactive once an option is chosen', () => {
    const getCallback = captureSheet();
    const onMenuActiveChange = jest.fn();
    const { result } = renderHook(() =>
      useDrawerChatMenu({ onMenuActiveChange })
    );

    act(() => result.current.openMenuFor(chat));
    act(() => getCallback()(3));

    expect(onMenuActiveChange).toHaveBeenLastCalledWith(false);
  });

  it('does not use the iOS action sheet on Android', () => {
    setPlatform('android');
    const spy = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions');
    const { result } = renderHook(() => useDrawerChatMenu());

    act(() => result.current.openMenuFor(chat));

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('actions', () => {
  it('exports the long-pressed chat under its label', async () => {
    const getCallback = captureSheet();
    const { result } = renderHook(() => useDrawerChatMenu());

    act(() => result.current.openMenuFor(chat));
    await act(async () => getCallback()(1));

    expect(mockExportChatRoom).toHaveBeenCalledWith({}, 7, 'Trip to Rome');
  });

  it('falls back to a generated label for a chat with no title', async () => {
    const getCallback = captureSheet();
    const { result } = renderHook(() => useDrawerChatMenu());

    act(() => result.current.openMenuFor(untitledChat));
    await act(async () => getCallback()(1));

    expect(mockExportChatRoom).toHaveBeenCalledWith({}, 9, 'Chat 9');
  });

  it('deletes the chat after the confirmation is accepted', async () => {
    const getCallback = captureSheet();
    const getConfirm = captureDeleteConfirm();
    const { result } = renderHook(() => useDrawerChatMenu());

    act(() => result.current.openMenuFor(chat));
    act(() => getCallback()(2));
    await act(async () => {
      await getConfirm()?.();
    });

    await waitFor(() =>
      expect(mockDeleteChat).toHaveBeenCalledWith(7, undefined)
    );
  });

  it('leaves the route alone when the deleted chat is not the open one', async () => {
    mockPathname = '/chat/123';
    const getCallback = captureSheet();
    const getConfirm = captureDeleteConfirm();
    const { result } = renderHook(() => useDrawerChatMenu());

    act(() => result.current.openMenuFor(chat));
    act(() => getCallback()(2));
    await act(async () => {
      await getConfirm()?.();
    });

    await waitFor(() => expect(mockDeleteChat).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('navigates home when the deleted chat is the open one', async () => {
    mockPathname = '/chat/7';
    const getCallback = captureSheet();
    const getConfirm = captureDeleteConfirm();
    const { result } = renderHook(() => useDrawerChatMenu());

    act(() => result.current.openMenuFor(chat));
    act(() => getCallback()(2));
    await act(async () => {
      await getConfirm()?.();
    });

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });
});

describe('rename flow', () => {
  it('keeps the rename modal hidden until rename is chosen', () => {
    const { result } = renderHook(() => useDrawerChatMenu());
    render(<>{result.current.MenuElements}</>);

    expect(screen.queryByDisplayValue('Trip to Rome')).toBeNull();
  });

  it('opens the rename modal seeded with the chat label', () => {
    const getCallback = captureSheet();
    const { result } = renderHook(() => useDrawerChatMenu());
    const { rerender } = render(<>{result.current.MenuElements}</>);

    act(() => result.current.openMenuFor(chat));
    act(() => getCallback()(0));
    rerender(<>{result.current.MenuElements}</>);

    expect(screen.getByDisplayValue('Trip to Rome')).toBeTruthy();
  });

  it('renames the long-pressed chat on submit', async () => {
    const getCallback = captureSheet();
    const { result } = renderHook(() => useDrawerChatMenu());
    const { rerender } = render(<>{result.current.MenuElements}</>);

    act(() => result.current.openMenuFor(chat));
    act(() => getCallback()(0));
    rerender(<>{result.current.MenuElements}</>);

    fireEvent.changeText(screen.getByDisplayValue('Trip to Rome'), 'Rome 2026');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() =>
      expect(mockRenameChat).toHaveBeenCalledWith(7, 'Rome 2026')
    );
  });

  it('keeps the menu active while the rename modal is open', () => {
    const getCallback = captureSheet();
    const onMenuActiveChange = jest.fn();
    const { result } = renderHook(() =>
      useDrawerChatMenu({ onMenuActiveChange })
    );
    render(<>{result.current.MenuElements}</>);

    act(() => result.current.openMenuFor(chat));
    act(() => getCallback()(0));

    expect(onMenuActiveChange).toHaveBeenCalledTimes(1);
    expect(onMenuActiveChange).toHaveBeenCalledWith(true);
  });

  it('releases the menu when the rename modal is cancelled', async () => {
    const getCallback = captureSheet();
    const onMenuActiveChange = jest.fn();
    const { result } = renderHook(() =>
      useDrawerChatMenu({ onMenuActiveChange })
    );
    const { rerender } = render(<>{result.current.MenuElements}</>);

    act(() => result.current.openMenuFor(chat));
    act(() => getCallback()(0));
    rerender(<>{result.current.MenuElements}</>);

    fireEvent.press(screen.getByText('Cancel'));

    await waitFor(() =>
      expect(onMenuActiveChange).toHaveBeenLastCalledWith(false)
    );
  });
});
