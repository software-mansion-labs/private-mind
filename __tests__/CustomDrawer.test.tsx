import React from 'react';
import { act, render } from '@testing-library/react-native';
import { BackHandler, Keyboard, Platform, TextInput } from 'react-native';
import {
  KeyboardController,
  KeyboardEvents,
} from 'react-native-keyboard-controller';
import CustomDrawer from '../components/drawer/CustomDrawer';
import {
  selectKeyboardOwnedElsewhere,
  useKeyboardOwnerStore,
} from '../store/keyboardOwnerStore';
import {
  ANDROID_KEYBOARD_RESHOW_DELAY,
  SEARCH_COLLAPSE_DURATION,
  SEARCH_FOCUS_DELAY,
} from '../constants/drawer-layout';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

jest.mock('../utils/Feedback', () => ({ Feedback: { drawer: jest.fn() } }));

let mockDrawerStatus = 'open';
jest.mock('expo-router/drawer', () => ({
  useDrawerStatus: () => mockDrawerStatus,
}));

type MenuProps = {
  searching: boolean;
  search: string;
  onChangeSearch: (value: string) => void;
  onOpenSearch: () => void;
  onCloseSearch: (instantly?: boolean) => void;
  onSearchBlur: () => void;
  onMenuActiveChange: (active: boolean) => void;
  onNavigate: () => void;
  inputRef: { current: TextInput | null };
};

let mockMenu: MenuProps;
jest.mock('../components/drawer/DrawerMenu', () => ({
  __esModule: true,
  default: (props: MenuProps) => {
    mockMenu = props;
    return null;
  },
}));

const ORIGINAL_OS = Platform.OS;
const setPlatform = (os: string) =>
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });

const makeInput = (focused = false) => ({
  focus: jest.fn(),
  isFocused: jest.fn(() => focused),
});

const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

const renderDrawer = () => {
  const onSearchingChange = jest.fn();
  const navigation = { closeDrawer: jest.fn() };
  const utils = render(
    <CustomDrawer
      {...({ navigation } as unknown as React.ComponentProps<
        typeof CustomDrawer
      >)}
      searchExpansion={{ get: () => 0, set: jest.fn() } as never}
      onSearchingChange={onSearchingChange}
    />
  );
  return { ...utils, onSearchingChange, navigation };
};

const attachInput = (input: ReturnType<typeof makeInput>) => {
  mockMenu.inputRef.current = input as unknown as TextInput;
};

const openSearch = () => act(() => mockMenu.onOpenSearch());

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockDrawerStatus = 'open';
  setPlatform('ios');
});

afterEach(() => {
  jest.useRealTimers();
  setPlatform(ORIGINAL_OS);
});

describe('CustomDrawer search', () => {
  it('tells the layout when search opens, so the drawer swipe can be disabled', () => {
    const { onSearchingChange } = renderDrawer();

    openSearch();

    expect(mockMenu.searching).toBe(true);
    expect(onSearchingChange).toHaveBeenLastCalledWith(true);
  });

  it('focuses the field only after the expand has mostly finished', () => {
    renderDrawer();
    const input = makeInput();
    attachInput(input);

    openSearch();
    advance(SEARCH_FOCUS_DELAY - 1);
    expect(input.focus).not.toHaveBeenCalled();

    advance(1);
    expect(input.focus).toHaveBeenCalledTimes(1);
  });

  it('does not focus the field if search closed before the delay ran out', () => {
    renderDrawer();
    const input = makeInput();
    attachInput(input);

    openSearch();
    act(() => mockMenu.onCloseSearch());
    advance(SEARCH_FOCUS_DELAY);

    expect(input.focus).not.toHaveBeenCalled();
  });

  it('keeps the filtered results until the collapse has finished', () => {
    renderDrawer();
    openSearch();
    act(() => mockMenu.onChangeSearch('pizza'));

    act(() => mockMenu.onCloseSearch());
    expect(mockMenu.searching).toBe(false);
    expect(mockMenu.search).toBe('pizza');

    advance(SEARCH_COLLAPSE_DURATION);
    expect(mockMenu.search).toBe('');
  });

  it('clears the query at once when closing instantly', () => {
    renderDrawer();
    openSearch();
    act(() => mockMenu.onChangeSearch('pizza'));

    act(() => mockMenu.onCloseSearch(true));

    expect(mockMenu.search).toBe('');
  });

  it('starts empty when reopened during the collapse of a previous query', () => {
    renderDrawer();
    openSearch();
    act(() => mockMenu.onChangeSearch('pizza'));
    act(() => mockMenu.onCloseSearch());

    openSearch();
    expect(mockMenu.search).toBe('');

    act(() => mockMenu.onChangeSearch('rome'));
    advance(SEARCH_COLLAPSE_DURATION);
    expect(mockMenu.search).toBe('rome');
  });

  it('closes when the field loses focus', () => {
    renderDrawer();
    openSearch();

    act(() => mockMenu.onSearchBlur());

    expect(mockMenu.searching).toBe(false);
  });

  it('stays open when the field loses focus to the chat menu', () => {
    renderDrawer();
    openSearch();

    act(() => mockMenu.onMenuActiveChange(true));
    act(() => mockMenu.onSearchBlur());

    expect(mockMenu.searching).toBe(true);
  });

  it('closes search on the Android back button instead of leaving the screen', () => {
    const listeners: Array<() => boolean> = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, fn) => {
      listeners.push(fn as () => boolean);
      return { remove: jest.fn() };
    });
    renderDrawer();
    openSearch();

    let handled = false;
    act(() => {
      handled = listeners[listeners.length - 1]();
    });

    expect(handled).toBe(true);
    expect(mockMenu.searching).toBe(false);
  });

  it('closes search when the drawer closes', () => {
    const view = renderDrawer();
    openSearch();

    mockDrawerStatus = 'closed';
    view.rerender(
      <CustomDrawer
        {...({ navigation: view.navigation } as unknown as React.ComponentProps<
          typeof CustomDrawer
        >)}
        searchExpansion={{ get: () => 0, set: jest.fn() } as never}
        onSearchingChange={view.onSearchingChange}
      />
    );

    expect(mockMenu.searching).toBe(false);
  });
});

describe('CustomDrawer keyboard ownership', () => {
  const ownsKeyboard = () =>
    useKeyboardOwnerStore.getState().drawerSearchOwnsKeyboard;

  afterEach(() => {
    jest.restoreAllMocks();
    jest.mocked(KeyboardController.isVisible).mockReturnValue(false);
    jest
      .mocked(KeyboardEvents.addListener)
      .mockImplementation(() => ({ remove: jest.fn() }) as never);
    useKeyboardOwnerStore.setState({ drawerSearchOwnsKeyboard: false });
  });

  it('keeps the screen behind from lifting while search is open', () => {
    renderDrawer();
    expect(ownsKeyboard()).toBe(false);

    openSearch();

    expect(ownsKeyboard()).toBe(true);
    expect(selectKeyboardOwnedElsewhere(useKeyboardOwnerStore.getState())).toBe(
      true
    );
  });

  it('holds on until the keyboard animation has fully ended, not at the earlier RN event', () => {
    jest.mocked(KeyboardController.isVisible).mockReturnValue(true);
    const listeners: Record<string, () => void> = {};
    jest.mocked(KeyboardEvents.addListener).mockImplementation(((
      event: string,
      listener: () => void
    ) => {
      listeners[event] = listener;
      return { remove: jest.fn() };
    }) as never);
    const rnAddListener = jest.spyOn(Keyboard, 'addListener');
    renderDrawer();
    openSearch();

    act(() => mockMenu.onCloseSearch());
    expect(ownsKeyboard()).toBe(true);
    expect(rnAddListener).not.toHaveBeenCalledWith(
      'keyboardDidHide',
      expect.anything()
    );

    act(() => listeners.keyboardDidHide());
    expect(ownsKeyboard()).toBe(false);
  });

  it('releases at once when the keyboard never came up', () => {
    jest.mocked(KeyboardController.isVisible).mockReturnValue(false);
    renderDrawer();
    openSearch();

    act(() => mockMenu.onCloseSearch());

    expect(ownsKeyboard()).toBe(false);
  });

  it('stays claimed when a chat menu releases its own hold mid-search', () => {
    renderDrawer();
    openSearch();

    act(() => useKeyboardOwnerStore.getState().setModalOwnsKeyboard(true));
    act(() => useKeyboardOwnerStore.getState().setModalOwnsKeyboard(false));

    expect(selectKeyboardOwnedElsewhere(useKeyboardOwnerStore.getState())).toBe(
      true
    );
  });
});

describe('CustomDrawer refocus after the chat menu', () => {
  it('reshows the Android keyboard, which the menu window dismissed', () => {
    setPlatform('android');
    renderDrawer();
    const input = makeInput(true);
    attachInput(input);
    openSearch();

    act(() => mockMenu.onMenuActiveChange(true));
    act(() => mockMenu.onMenuActiveChange(false));
    expect(input.focus).toHaveBeenCalled();
    expect(KeyboardController.setFocusTo).not.toHaveBeenCalled();

    advance(ANDROID_KEYBOARD_RESHOW_DELAY);
    expect(KeyboardController.setFocusTo).toHaveBeenCalledWith('current');
  });

  it('does not reshow the keyboard if search closed in the meantime', () => {
    setPlatform('android');
    renderDrawer();
    attachInput(makeInput(true));
    openSearch();

    act(() => mockMenu.onMenuActiveChange(false));
    act(() => mockMenu.onCloseSearch());
    advance(ANDROID_KEYBOARD_RESHOW_DELAY);

    expect(KeyboardController.setFocusTo).not.toHaveBeenCalled();
  });

  it('only refocuses on iOS', () => {
    renderDrawer();
    const input = makeInput(true);
    attachInput(input);
    openSearch();

    act(() => mockMenu.onMenuActiveChange(false));
    advance(ANDROID_KEYBOARD_RESHOW_DELAY);

    expect(input.focus).toHaveBeenCalled();
    expect(KeyboardController.setFocusTo).not.toHaveBeenCalled();
  });
});

describe('CustomDrawer navigating from search', () => {
  const flushPromises = () => act(async () => {});
  const flushFrames = () => advance(100);

  const keyboardHidesOnResolve = () => {
    let hide = () => {};
    jest.mocked(KeyboardController.dismiss).mockReturnValue(
      new Promise<void>((resolve) => {
        hide = resolve;
      })
    );
    return () => hide();
  };

  beforeEach(() => setPlatform('android'));

  afterEach(() => {
    jest.mocked(KeyboardController.dismiss).mockReset();
  });

  it('leaves the results on screen and the drawer open until the keyboard is down', async () => {
    const hideKeyboard = keyboardHidesOnResolve();
    const { navigation } = renderDrawer();
    openSearch();
    act(() => mockMenu.onChangeSearch('machine'));

    act(() => {
      mockMenu.onNavigate();
    });
    flushFrames();

    expect(KeyboardController.dismiss).toHaveBeenCalledWith({
      keepFocus: true,
    });
    expect(mockMenu.searching).toBe(true);
    expect(mockMenu.search).toBe('machine');
    expect(navigation.closeDrawer).not.toHaveBeenCalled();

    hideKeyboard();
    await flushPromises();
    flushFrames();

    expect(mockMenu.searching).toBe(false);
    expect(mockMenu.search).toBe('');
    expect(navigation.closeDrawer).toHaveBeenCalledTimes(1);
  });

  it('does not wait for the keyboard on iOS', () => {
    setPlatform('ios');
    const { navigation } = renderDrawer();
    openSearch();

    act(() => {
      mockMenu.onNavigate();
    });
    flushFrames();

    expect(KeyboardController.dismiss).not.toHaveBeenCalled();
    expect(navigation.closeDrawer).toHaveBeenCalledTimes(1);
  });
});
