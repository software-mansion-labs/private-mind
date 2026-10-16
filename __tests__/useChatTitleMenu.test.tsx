import React from 'react';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react-native';
import { Alert, Text, TouchableOpacity } from 'react-native';

// ── mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: { ...require('../styles/colors').lightTheme },
  }),
}));

jest.mock('react-native-keyboard-controller', () => ({
  OverKeyboardView: ({ children }: { children: React.ReactNode }) => children,
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

import { useChatTitleMenu } from '../components/chat-screen/ChatTitleMenu';

const Harness = ({ chatTitle = 'My Chat' }: { chatTitle?: string }) => {
  const { openMenu, isOpen, MenuElements } = useChatTitleMenu({
    chatId: 42,
    chatTitle,
    anchorTop: 100,
  });
  return (
    <>
      <TouchableOpacity testID="open-menu" onPress={openMenu} />
      <Text>{`menu:${isOpen ? 'open' : 'closed'}`}</Text>
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

describe('renaming inside the menu', () => {
  it('turns the title into a field holding the current name', () => {
    openMenu();
    fireEvent.press(screen.getByTestId('chat-menu-rename'));
    expect(screen.getByDisplayValue('My Chat')).toBeTruthy();
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
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
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
