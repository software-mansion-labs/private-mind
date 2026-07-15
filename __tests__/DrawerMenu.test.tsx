import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Platform, ActionSheetIOS } from 'react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

jest.mock('react-native-gesture-handler', () => {
  const RN = require('react-native');
  return { ScrollView: RN.ScrollView, Pressable: RN.Pressable };
});

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: jest.fn(() => ({})),
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockPathname = '/';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: jest.fn() }),
  usePathname: () => mockPathname,
}));

const mockStartPhantomChat = jest.fn();
jest.mock('../utils/startPhantomChat', () => ({
  startPhantomChat: (...args: unknown[]) => mockStartPhantomChat(...args),
}));

const mockInterrupt = jest.fn();
jest.mock('../store/llmStore', () => ({
  useLLMStore: jest.fn(() => ({ interrupt: mockInterrupt })),
}));

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const mockNow = new Date('2026-03-10T12:00:00Z').getTime();
const mockChats = [
  { id: 1, modelId: 1, title: 'Pizza recipe', lastUsed: mockNow - HOUR },
  { id: 2, modelId: 1, title: 'Meeting notes', lastUsed: mockNow - 2 * HOUR },
  { id: 3, modelId: 1, title: 'Trip to Rome', lastUsed: mockNow - DAY },
];

const mockRenameChat = jest.fn();
const mockDeleteChat = jest.fn();
jest.mock('../store/chatStore', () => ({
  useChatStore: jest.fn(() => ({
    chats: mockChats,
    phantomChat: null,
    renameChat: mockRenameChat,
    deleteChat: mockDeleteChat,
  })),
}));

jest.mock('../context/VectorStoreContext', () => ({
  useVectorStore: jest.fn(() => ({ vectorStore: null })),
}));

jest.mock('../database/exportImportRepository', () => ({
  exportChatRoom: jest.fn(),
}));

import DrawerMenu from '../components/drawer/DrawerMenu';

const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

const defaultProps = {
  searching: false,
  search: '',
  now: mockNow,
  navHeight: 151,
  onNavMeasured: jest.fn(),
  onChangeSearch: jest.fn(),
  onOpenSearch: jest.fn(),
  onCloseSearch: jest.fn(),
};

type MenuProps = React.ComponentProps<typeof DrawerMenu>;

const renderMenu = (props: Partial<MenuProps> = {}) =>
  render(<DrawerMenu {...defaultProps} {...props} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/';
  setPlatform('ios');
});

describe('DrawerMenu — collapsed', () => {
  it('keeps New chat, Models and App Info at the top', () => {
    renderMenu();

    expect(screen.getByText('New chat')).toBeTruthy();
    expect(screen.getByText('Models')).toBeTruthy();
    expect(screen.getByText('App Info')).toBeTruthy();
  });

  it('renders the app name and a search button instead of a search field', () => {
    renderMenu();

    expect(screen.getByText('Private Mind')).toBeTruthy();
    expect(screen.getByTestId('drawer-search-open')).toBeTruthy();
    expect(screen.queryByTestId('drawer-search-input')).toBeNull();
  });

  it('requests the search state when the search icon is pressed', () => {
    const onOpenSearch = jest.fn();
    renderMenu({ onOpenSearch });

    fireEvent.press(screen.getByTestId('drawer-search-open'));

    expect(onOpenSearch).toHaveBeenCalled();
  });

  it('renders chats grouped by relative date', () => {
    renderMenu();

    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByText('Pizza recipe')).toBeTruthy();
  });

  it('groups chats against the given now instead of the wall clock', () => {
    const { rerender } = render(<DrawerMenu {...defaultProps} />);
    expect(screen.getByText('Today')).toBeTruthy();

    rerender(<DrawerMenu {...defaultProps} now={mockNow + 30 * HOUR} />);

    expect(screen.queryByText('Today')).toBeNull();
    expect(screen.getByText('Yesterday')).toBeTruthy();
    expect(screen.getByText('2 days ago')).toBeTruthy();
  });

  it('records the scroll offset it was scrolled to', () => {
    const scrollOffsetRef = { current: 0 };
    renderMenu({ scrollOffsetRef });

    fireEvent.scroll(screen.getByTestId('drawer-scroll'), {
      nativeEvent: { contentOffset: { x: 0, y: 120 } },
    });

    expect(scrollOffsetRef.current).toBe(120);
  });

  it('keeps the sections identical between the collapsed and searching states', () => {
    const sectionsOf = (element: React.ReactElement) => {
      const view = render(element);
      const titles = ['Today', 'Yesterday', '2 days ago'].filter(
        (title) => view.queryByText(title) !== null
      );
      view.unmount();
      return titles;
    };

    expect(sectionsOf(<DrawerMenu {...defaultProps} searching />)).toEqual(
      sectionsOf(<DrawerMenu {...defaultProps} />)
    );
  });

  it('starts a phantom chat when New chat is pressed', () => {
    mockPathname = '/model-hub';
    const onNavigate = jest.fn();
    renderMenu({ onNavigate });

    fireEvent.press(screen.getByTestId('drawer-new-chat'));

    expect(mockStartPhantomChat).toHaveBeenCalledWith({}, 'replace');
    expect(onNavigate).toHaveBeenCalled();
  });

  it('navigates to the chat when an item is pressed', () => {
    renderMenu();

    fireEvent.press(screen.getByTestId('drawer-chat-1'));

    expect(mockReplace).toHaveBeenCalledWith('/chat/1');
  });
});

describe('DrawerMenu — searching', () => {
  it('shows the search field and back button instead of the search icon', () => {
    renderMenu({ searching: true });

    expect(screen.getByTestId('drawer-search-back')).toBeTruthy();
    expect(screen.getByTestId('drawer-search-input')).toBeTruthy();
    expect(screen.queryByTestId('drawer-search-open')).toBeNull();
  });

  it('opens the list at the offset the drawer was scrolled to', () => {
    const scrollOffsetRef = { current: 120 };
    renderMenu({ searching: true, scrollOffsetRef });

    expect(screen.getByTestId('drawer-scroll').props.contentOffset).toEqual({
      x: 0,
      y: 120,
    });
  });

  it('does not record the offset of a filtered list', () => {
    const scrollOffsetRef = { current: 120 };
    renderMenu({
      searching: true,
      search: 'meeting',
      scrollOffsetRef,
    });

    fireEvent.scroll(screen.getByTestId('drawer-scroll'), {
      nativeEvent: { contentOffset: { x: 0, y: 0 } },
    });

    expect(scrollOffsetRef.current).toBe(120);
  });

  it('keeps the navigation items while the query is still empty', () => {
    renderMenu({ searching: true });

    expect(screen.getByText('New chat')).toBeTruthy();
    expect(screen.getByText('Models')).toBeTruthy();
    expect(screen.getByText('App Info')).toBeTruthy();
  });

  it('hides the navigation items once a query is typed, leaving only results', () => {
    renderMenu({ searching: true, search: 'pizza' });

    expect(screen.queryByText('New chat')).toBeNull();
    expect(screen.queryByText('Models')).toBeNull();
    expect(screen.queryByText('App Info')).toBeNull();
    expect(screen.getByText('Pizza recipe')).toBeTruthy();
  });

  it('brings the navigation back when the query is cleared', () => {
    const { rerender } = renderMenu({ searching: true, search: 'pizza' });
    expect(screen.queryByText('Models')).toBeNull();

    rerender(
      <DrawerMenu
        {...defaultProps}
        searching
        search=""
        onNavigate={jest.fn()}
      />
    );

    expect(screen.getByText('Models')).toBeTruthy();
  });

  it('filters the chat list by the query', () => {
    renderMenu({ searching: true, search: 'rome' });

    expect(screen.getByText('Trip to Rome')).toBeTruthy();
    expect(screen.queryByText('Pizza recipe')).toBeNull();
    expect(screen.queryByText('Today')).toBeNull();
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    renderMenu({ searching: true, search: '  PIZZA  ' });

    expect(screen.getByText('Pizza recipe')).toBeTruthy();
    expect(screen.queryByText('Trip to Rome')).toBeNull();
  });

  it('shows an empty state when nothing matches', () => {
    renderMenu({ searching: true, search: 'nonexistent' });

    expect(screen.getByText('No chats found')).toBeTruthy();
    expect(screen.getByText('Start new chat')).toBeTruthy();
  });

  it('starts a new chat from the empty state', () => {
    const onNavigate = jest.fn();
    renderMenu({
      searching: true,
      search: 'nonexistent',
      onNavigate,
    });

    fireEvent.press(screen.getByText('Start new chat'));

    expect(mockStartPhantomChat).toHaveBeenCalledWith({}, 'replace');
    expect(onNavigate).toHaveBeenCalled();
  });

  it('closes the search state from the back button', () => {
    const onCloseSearch = jest.fn();
    renderMenu({ searching: true, onCloseSearch });

    fireEvent.press(screen.getByTestId('drawer-search-back'));

    expect(onCloseSearch).toHaveBeenCalled();
  });
});

describe('DrawerMenu — context menu', () => {
  it('opens the context menu on long press', () => {
    const spy = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => {});

    renderMenu();

    fireEvent(screen.getByTestId('drawer-chat-1'), 'longPress');

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: ['Rename', 'Export Chat', 'Delete Chat', 'Cancel'],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 3,
      }),
      expect.any(Function)
    );
  });

  it('does not open the context menu on a plain press', () => {
    const spy = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => {});

    renderMenu();

    fireEvent.press(screen.getByTestId('drawer-chat-1'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('reports the menu as active so the search state is not torn down', () => {
    jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation(() => {});
    const onMenuActiveChange = jest.fn();

    renderMenu({ searching: true, onMenuActiveChange });

    fireEvent(screen.getByTestId('drawer-chat-1'), 'longPress');

    expect(onMenuActiveChange).toHaveBeenCalledWith(true);
  });
});
