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

// ── mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: { ...require('../styles/colors').lightTheme },
  }),
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
  exportChatRoom: (...args: any[]) => mockExportChatRoom(...args),
}));

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  },
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

const mockRouter = jest.requireMock('expo-router').router as {
  replace: jest.Mock;
  push: jest.Mock;
  back: jest.Mock;
};

import Toast from 'react-native-toast-message';

// ── component under test ───────────────────────────────────────────────────────

import { useChatTitleMenu } from '../components/chat-screen/ChatTitleMenu';

const defaultOptions = { chatId: 42, chatTitle: 'My Chat' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockRenameChat.mockResolvedValue(undefined);
  mockDeleteChat.mockResolvedValue(undefined);
  mockExportChatRoom.mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

// ─── iOS path ─────────────────────────────────────────────────────────────────

describe('iOS', () => {
  beforeEach(() => {
    setPlatform('ios');
  });

  it('calls ActionSheetIOS.showActionSheetWithOptions with the expected options', () => {
    const spy = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => {});
    const { result } = renderHook(() => useChatTitleMenu(defaultOptions));

    act(() => {
      result.current.openMenu();
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: ['Rename', 'Export Chat', 'Delete Chat', 'Cancel'],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 3,
      }),
      expect.any(Function)
    );
  });

  it('calls exportChatRoom when index 1 is chosen', async () => {
    let capturedCallback: ((index: number) => void) | null = null;
    jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => {
        capturedCallback = callback;
      });

    const { result } = renderHook(() => useChatTitleMenu(defaultOptions));

    act(() => {
      result.current.openMenu();
    });

    await act(async () => {
      capturedCallback!(1);
    });

    expect(mockExportChatRoom).toHaveBeenCalledWith({}, 42, 'My Chat');
  });

  it('triggers Alert.alert for delete when index 2 is chosen', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    let capturedCallback: ((index: number) => void) | null = null;
    jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => {
        capturedCallback = callback;
      });

    const { result } = renderHook(() => useChatTitleMenu(defaultOptions));

    act(() => {
      result.current.openMenu();
    });

    act(() => {
      capturedCallback!(2);
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Chat',
      expect.any(String),
      expect.any(Array)
    );
  });

  it('calls deleteChat and router.replace("/") when Delete is confirmed', async () => {
    let capturedCallback: ((index: number) => void) | null = null;
    jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => {
        capturedCallback = callback;
      });

    let capturedOnPress: (() => Promise<void>) | undefined;
    jest.spyOn(Alert, 'alert').mockImplementation((...args: any[]) => {
      const buttons = args[2];
      const deleteBtn = Array.isArray(buttons)
        ? buttons.find((b: any) => b.text === 'Delete')
        : undefined;
      capturedOnPress = deleteBtn?.onPress;
    });

    const { result } = renderHook(() => useChatTitleMenu(defaultOptions));

    act(() => {
      result.current.openMenu();
    });

    act(() => {
      capturedCallback!(2);
    });

    await act(async () => {
      await capturedOnPress?.();
    });

    await waitFor(() => {
      expect(mockDeleteChat).toHaveBeenCalledWith(42, undefined);
    });
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('does NOT call ActionSheetIOS on Android', () => {
    setPlatform('android');
    const spy = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions');
    const { result } = renderHook(() => useChatTitleMenu(defaultOptions));

    act(() => {
      result.current.openMenu();
    });

    expect(spy).not.toHaveBeenCalled();
  });
});

// ─── Android path ─────────────────────────────────────────────────────────────

describe('Android', () => {
  beforeEach(() => {
    setPlatform('android');
  });

  it('does not call ActionSheetIOS when Platform.OS is android', () => {
    const spy = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions');
    const { result } = renderHook(() => useChatTitleMenu(defaultOptions));

    act(() => {
      result.current.openMenu();
    });

    expect(spy).not.toHaveBeenCalled();
  });
});

// ─── Rename flow (via MenuElements) ──────────────────────────────────────────

describe('rename flow via MenuElements', () => {
  beforeEach(() => {
    setPlatform('ios');
  });

  it('renders RenameChatModal with visible=false initially', () => {
    const { result } = renderHook(() => useChatTitleMenu(defaultOptions));
    render(<>{result.current.MenuElements}</>);
    // Modal exists but is not visible — input should not be in the tree
    expect(screen.queryByDisplayValue('My Chat')).toBeNull();
  });

  it('shows RenameChatModal after rename is chosen on iOS', () => {
    let capturedCallback: ((index: number) => void) | null = null;
    jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => {
        capturedCallback = callback;
      });

    const { result } = renderHook(() => useChatTitleMenu(defaultOptions));
    const { rerender } = render(<>{result.current.MenuElements}</>);

    act(() => {
      result.current.openMenu();
    });

    act(() => {
      capturedCallback!(0); // Rename
    });

    rerender(<>{result.current.MenuElements}</>);
    expect(screen.getByDisplayValue('My Chat')).toBeTruthy();
  });

  it('calls renameChat with the submitted title', async () => {
    let capturedCallback: ((index: number) => void) | null = null;
    jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => {
        capturedCallback = callback;
      });

    const { result } = renderHook(() => useChatTitleMenu(defaultOptions));
    const { rerender } = render(<>{result.current.MenuElements}</>);

    act(() => {
      result.current.openMenu();
    });

    act(() => {
      capturedCallback!(0);
    });

    rerender(<>{result.current.MenuElements}</>);

    fireEvent.changeText(screen.getByDisplayValue('My Chat'), 'Renamed Chat');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockRenameChat).toHaveBeenCalledWith(42, 'Renamed Chat');
    });
  });

  it('shows Toast after successful rename', async () => {
    let capturedCallback: ((index: number) => void) | null = null;
    jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_options, callback) => {
        capturedCallback = callback;
      });

    const { result } = renderHook(() => useChatTitleMenu(defaultOptions));
    const { rerender } = render(<>{result.current.MenuElements}</>);

    act(() => {
      result.current.openMenu();
    });

    act(() => {
      capturedCallback!(0);
    });

    rerender(<>{result.current.MenuElements}</>);

    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ text1: 'Chat renamed' })
      );
    });
  });
});
