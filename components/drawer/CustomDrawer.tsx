import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { KeyboardController } from 'react-native-keyboard-controller';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useHoldKeyboardWhileOpen } from '../../hooks/useHoldKeyboardWhileOpen';
import { useKeyboardOwnerStore } from '../../store/keyboardOwnerStore';
import { Theme } from '../../styles/colors';
import DrawerMenu from './DrawerMenu';
import { useNewChatCollapse } from './useNewChatCollapse';
import { useSearchExpansion } from './useSearchExpansion';
import { Feedback } from '../../utils/Feedback';
import {
  ANDROID_KEYBOARD_RESHOW_DELAY,
  getDrawerWidth,
  SEARCH_COLLAPSE_DURATION,
  SEARCH_FOCUS_DELAY,
} from '../../constants/drawer-layout';
import {
  DrawerContentComponentProps,
  useDrawerStatus,
} from 'expo-router/drawer';

interface Props extends DrawerContentComponentProps {
  searchExpansion: SharedValue<number>;
  onSearchingChange: (searching: boolean) => void;
}

const CustomDrawer = ({
  navigation,
  searchExpansion,
  onSearchingChange,
}: Props) => {
  const isFirstRender = useRef(true);
  const { styles } = useThemedStyles(createStyles);
  const status = useDrawerStatus();
  const { width: screenWidth } = useWindowDimensions();
  const drawerWidth = getDrawerWidth(screenWidth);

  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [navHeight, setNavHeight] = useState(0);
  const menuActiveRef = useRef(false);
  const inputRef = useRef<TextInput | null>(null);
  const scrollOffsetRef = useRef(0);
  const clearSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reshowKeyboardTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const { newChatCollapse, trackScroll } = useNewChatCollapse();
  const setDrawerSearchOwnsKeyboard = useKeyboardOwnerStore(
    (state) => state.setDrawerSearchOwnsKeyboard
  );
  useHoldKeyboardWhileOpen(searching, setDrawerSearchOwnsKeyboard);
  const { iconMorph, footerOpacity, expand, collapse } =
    useSearchExpansion(searchExpansion);

  const contentStyle = useAnimatedStyle(() => ({
    width: searchExpansion.get() > 0 ? screenWidth : drawerWidth,
  }));

  const cancelClearSearch = useCallback(() => {
    if (clearSearchTimer.current) clearTimeout(clearSearchTimer.current);
    clearSearchTimer.current = null;
  }, []);

  const cancelReshowKeyboard = useCallback(() => {
    if (reshowKeyboardTimer.current) clearTimeout(reshowKeyboardTimer.current);
    reshowKeyboardTimer.current = null;
  }, []);

  useEffect(() => cancelClearSearch, [cancelClearSearch]);
  useEffect(() => cancelReshowKeyboard, [cancelReshowKeyboard]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    Feedback.drawer();
  }, [status]);

  useEffect(() => {
    if (status === 'open') setNow(Date.now());
  }, [status]);

  useEffect(() => {
    onSearchingChange(searching);
    if (!searching) return;
    const focusInput = setTimeout(
      () => inputRef.current?.focus(),
      SEARCH_FOCUS_DELAY
    );
    return () => clearTimeout(focusInput);
  }, [searching, onSearchingChange]);

  const closeSearch = useCallback(
    (instantly = false) => {
      Keyboard.dismiss();
      menuActiveRef.current = false;
      collapse(instantly);
      setSearching(false);
      cancelClearSearch();
      cancelReshowKeyboard();

      if (instantly) {
        setSearch('');
        return;
      }

      clearSearchTimer.current = setTimeout(
        () => setSearch(''),
        SEARCH_COLLAPSE_DURATION
      );
    },
    [collapse, cancelClearSearch, cancelReshowKeyboard]
  );

  const openSearch = useCallback(() => {
    cancelClearSearch();
    setSearch('');
    expand();
    setSearching(true);
  }, [cancelClearSearch, expand]);

  useEffect(() => {
    if (status === 'closed' && searching) closeSearch(true);
  }, [status, searching, closeSearch]);

  useEffect(() => {
    if (!searching) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        closeSearch();
        return true;
      }
    );
    return () => subscription.remove();
  }, [searching, closeSearch]);

  const handleSearchBlur = useCallback(() => {
    if (menuActiveRef.current) return;
    closeSearch();
  }, [closeSearch]);

  const handleNavigate = useCallback(async () => {
    if (Platform.OS === 'android') {
      await KeyboardController.dismiss({ keepFocus: true });
    }
    closeSearch(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => navigation.closeDrawer());
    });
  }, [closeSearch, navigation]);

  const handleMenuActiveChange = useCallback(
    (active: boolean) => {
      menuActiveRef.current = active;
      cancelReshowKeyboard();
      if (active) return;

      inputRef.current?.focus();
      if (Platform.OS !== 'android') return;
      reshowKeyboardTimer.current = setTimeout(() => {
        if (inputRef.current?.isFocused()) {
          KeyboardController.setFocusTo('current');
        }
      }, ANDROID_KEYBOARD_RESHOW_DELAY);
    },
    [cancelReshowKeyboard]
  );

  return (
    <Animated.View
      style={[styles.container, contentStyle]}
      accessibilityViewIsModal={searching}
    >
      <DrawerMenu
        searching={searching}
        search={search}
        now={now}
        navHeight={navHeight}
        onNavMeasured={setNavHeight}
        onChangeSearch={setSearch}
        onOpenSearch={openSearch}
        onCloseSearch={closeSearch}
        onSearchBlur={handleSearchBlur}
        onMenuActiveChange={handleMenuActiveChange}
        onNavigate={handleNavigate}
        inputRef={inputRef}
        scrollOffsetRef={scrollOffsetRef}
        searchProgress={iconMorph}
        searchExpansion={searchExpansion}
        footerOpacity={footerOpacity}
        resetScrollPosition={status === 'closed'}
        newChatCollapse={newChatCollapse}
        onListScroll={trackScroll}
      />
    </Animated.View>
  );
};

export default CustomDrawer;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
  });
