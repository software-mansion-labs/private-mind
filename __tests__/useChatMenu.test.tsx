import React from 'react';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react-native';
import { Alert, Modal, Platform, Text, TouchableOpacity } from 'react-native';

// ── mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('react-native-keyboard-controller', () => ({
  OverKeyboardView: ({ children }: { children: React.ReactNode }) => children,
  useKeyboardState: (
    selector: (state: { isVisible: boolean; height: number }) => unknown
  ) => selector({ isVisible: false, height: 0 }),
}));

jest.mock('../utils/Feedback', () => ({
  Feedback: { sheetOpen: jest.fn() },
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

const mockReplace = jest.fn();
let mockPathname = '/chat/42';
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
  usePathname: () => mockPathname,
}));

import Toast from 'react-native-toast-message';

import { useChatMenu } from '../components/chat-menu/useChatMenu';
import { MAX_CHAT_TITLE_LENGTH } from '../utils/chatLabel';

const TARGET = {
  x: 16,
  y: 100,
  width: 280,
  height: 44,
  align: 'start' as const,
};

const Harness = ({
  chatTitle = 'My Chat',
  onActiveChange,
}: {
  chatTitle?: string;
  onActiveChange?: (active: boolean) => void;
}) => {
  const { openMenu, openChatId, MenuElements } = useChatMenu({
    onActiveChange,
  });
  return (
    <>
      <TouchableOpacity
        testID="open-menu"
        onPress={() => openMenu({ id: 42, title: chatTitle }, TARGET)}
      />
      <Text>{`menu:${openChatId === 42 ? 'open' : 'closed'}`}</Text>
      {MenuElements}
    </>
  );
};

const openMenu = () => {
  render(<Harness />);
  fireEvent.press(screen.getByTestId('open-menu'));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/chat/42';
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockRenameChat.mockResolvedValue(undefined);
  mockDeleteChat.mockResolvedValue(undefined);
  mockExportChatRoom.mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('opening the chat menu', () => {
  it('stays closed until the title is tapped', () => {
    render(<Harness />);
    expect(screen.getByText('menu:closed')).toBeTruthy();
    expect(screen.queryByTestId('chat-menu')).toBeNull();
  });

  it('opens a menu naming the chat, with no model choice in it', () => {
    openMenu();
    expect(screen.getByText('menu:open')).toBeTruthy();
    expect(screen.getByText('Chat')).toBeTruthy();
    expect(screen.getByText('My Chat')).toBeTruthy();
    expect(screen.getByText('Share')).toBeTruthy();
    expect(screen.getByText('Delete chat')).toBeTruthy();
    expect(screen.queryByText('Model')).toBeNull();
    expect(screen.queryByText('All models')).toBeNull();
  });

  it('falls back to the numbered label for an untitled chat', () => {
    render(<Harness chatTitle="" />);
    fireEvent.press(screen.getByTestId('open-menu'));
    expect(screen.getByText('Chat 42')).toBeTruthy();
  });

  it('closes from a tap outside the menu', () => {
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-backdrop'));
    expect(screen.getByText('menu:closed')).toBeTruthy();
  });
});

describe('the chat menu on Android', () => {
  const ORIGINAL_OS = Platform.OS;
  const setPlatform = (os: string) =>
    Object.defineProperty(Platform, 'OS', {
      get: () => os,
      configurable: true,
    });

  beforeEach(() => setPlatform('android'));
  afterEach(() => setPlatform(ORIGINAL_OS));

  const menuWindow = () => {
    let node = screen.getByTestId('chat-menu').parent;
    while (node && node.type !== Modal) node = node.parent;
    return node;
  };

  it('opens in a window the name field can type into', () => {
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-rename'));
    expect(menuWindow()?.props.visible).toBe(true);
    expect(screen.getByTestId('chat-menu-rename-input')).toBeTruthy();
  });

  it('closes on the back button instead of leaving the chat', () => {
    openMenu();
    fireEvent(menuWindow()!, 'requestClose');
    expect(screen.getByText('menu:closed')).toBeTruthy();
  });
});

describe('renaming inside the menu', () => {
  it('turns the title into a field holding the current name', () => {
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-rename'));
    expect(screen.getByDisplayValue('My Chat')).toBeTruthy();
  });

  it('caps the name at the same length as every other chat title', () => {
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-rename'));
    expect(screen.getByTestId('chat-menu-rename-input').props.maxLength).toBe(
      MAX_CHAT_TITLE_LENGTH
    );
  });

  it('saves the edited name', async () => {
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-rename'));
    fireEvent.changeText(screen.getByDisplayValue('My Chat'), 'Renamed Chat');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockRenameChat).toHaveBeenCalledWith(42, 'Renamed Chat');
    });
    expect(screen.queryByTestId('chat-menu-rename-input')).toBeNull();
  });

  it('saves from the keyboard return key too', async () => {
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-rename'));
    const field = screen.getByDisplayValue('My Chat');
    fireEvent.changeText(field, 'From return');
    fireEvent(field, 'submitEditing');

    await waitFor(() => {
      expect(mockRenameChat).toHaveBeenCalledWith(42, 'From return');
    });
  });

  it('leaves the chat alone when the name is unchanged or blank', () => {
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-rename'));
    fireEvent.press(screen.getByText('Save'));
    fireEvent.press(screen.getByTestId('chat-menu-rename'));
    fireEvent.changeText(screen.getByDisplayValue('My Chat'), '   ');
    fireEvent.press(screen.getByText('Save'));

    expect(mockRenameChat).not.toHaveBeenCalled();
  });

  it('renames without putting a toast over the chat', async () => {
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-rename'));
    fireEvent.changeText(screen.getByDisplayValue('My Chat'), 'Quiet');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(mockRenameChat).toHaveBeenCalled());
    expect(Toast.show).not.toHaveBeenCalled();
  });
});

describe('sharing and deleting', () => {
  it('closes the menu and exports the chat on Share', async () => {
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-share'));

    expect(screen.getByText('menu:closed')).toBeTruthy();
    await waitFor(() => {
      expect(mockExportChatRoom).toHaveBeenCalledWith(
        expect.anything(),
        42,
        'My Chat'
      );
    });
  });

  it('asks before deleting', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-delete'));

    expect(screen.getByText('menu:closed')).toBeTruthy();
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Chat',
      expect.any(String),
      expect.any(Array)
    );
  });

  it('deletes the chat and leaves it once confirmed', async () => {
    let confirm: (() => Promise<void>) | undefined;
    jest.spyOn(Alert, 'alert').mockImplementation((...args: any[]) => {
      const buttons = args[2];
      confirm = Array.isArray(buttons)
        ? buttons.find((b: any) => b.text === 'Delete')?.onPress
        : undefined;
    });
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-delete'));

    await act(async () => {
      await confirm?.();
    });

    await waitFor(() => {
      expect(mockDeleteChat).toHaveBeenCalledWith(42, undefined);
    });
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('stays on the current chat when a different chat is deleted', async () => {
    mockPathname = '/chat/7';
    let confirm: (() => Promise<void>) | undefined;
    jest.spyOn(Alert, 'alert').mockImplementation((...args: any[]) => {
      confirm = args[2]?.find((b: any) => b.text === 'Delete')?.onPress;
    });
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-delete'));

    await act(async () => {
      await confirm?.();
    });

    await waitFor(() => expect(mockDeleteChat).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('reporting the menu as active', () => {
  it('reports active on open and inactive once dismissed', () => {
    const onActiveChange = jest.fn();
    render(<Harness onActiveChange={onActiveChange} />);
    fireEvent.press(screen.getByTestId('open-menu'));
    expect(onActiveChange).toHaveBeenLastCalledWith(true);

    fireEvent.press(screen.getByTestId('chat-menu-backdrop'));
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
  });

  it('stays active until the delete confirmation is answered', async () => {
    let cancel: (() => void) | undefined;
    jest.spyOn(Alert, 'alert').mockImplementation((...args: any[]) => {
      cancel = args[2]?.find((b: any) => b.text === 'Cancel')?.onPress;
    });
    const onActiveChange = jest.fn();
    render(<Harness onActiveChange={onActiveChange} />);
    fireEvent.press(screen.getByTestId('open-menu'));
    fireEvent.press(screen.getByTestId('chat-menu-delete'));

    expect(screen.getByText('menu:closed')).toBeTruthy();
    expect(onActiveChange).toHaveBeenLastCalledWith(true);

    await act(async () => cancel?.());

    await waitFor(() => expect(onActiveChange).toHaveBeenLastCalledWith(false));
  });

  it('shows the new name in the menu right after renaming', async () => {
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-rename'));
    fireEvent.changeText(screen.getByDisplayValue('My Chat'), 'Fresh name');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByText('Fresh name')).toBeTruthy());
  });
});

describe('keeping the chat still while renaming', () => {
  const { useKeyboardOwnerStore } = jest.requireActual(
    '../store/keyboardOwnerStore'
  );
  const ownsKeyboard = () => useKeyboardOwnerStore.getState().modalOwnsKeyboard;

  beforeEach(() =>
    useKeyboardOwnerStore.setState({ modalOwnsKeyboard: false })
  );

  it('holds the keyboard for the menu while it is open', () => {
    openMenu();
    expect(ownsKeyboard()).toBe(true);
  });

  it('hands the keyboard back once the menu closes', () => {
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-backdrop'));
    expect(ownsKeyboard()).toBe(false);
  });

  it('leaves another owner alone while the menu was never opened', () => {
    useKeyboardOwnerStore.setState({ modalOwnsKeyboard: true });
    render(<Harness />);
    expect(ownsKeyboard()).toBe(true);
  });
});
