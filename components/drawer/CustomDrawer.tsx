import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, StyleSheet, TextInput, Keyboard } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import DrawerMenu from './DrawerMenu';
import { DrawerSearchOverlay } from './DrawerSearchOverlay';
import { Feedback } from '../../utils/Feedback';
import { getDrawerTopPadding } from '../../constants/drawer-layout';
import {
  DrawerContentComponentProps,
  useDrawerStatus,
} from '@react-navigation/drawer';

const CustomDrawer = ({ navigation }: DrawerContentComponentProps) => {
  const isFirstRender = useRef(true);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const status = useDrawerStatus();

  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [closeInstantly, setCloseInstantly] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [navHeight, setNavHeight] = useState(0);
  const menuActiveRef = useRef(false);
  const inputRef = useRef<TextInput | null>(null);
  const scrollOffsetRef = useRef(0);
  const collapsedScrollRef = useRef<ScrollView | null>(null);

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
    if (status === 'closed' && searching) {
      setSearching(false);
      setSearch('');
    }
  }, [status, searching]);

  const closeSearch = useCallback((instantly = false) => {
    Keyboard.dismiss();
    menuActiveRef.current = false;
    collapsedScrollRef.current?.scrollTo({
      y: scrollOffsetRef.current,
      animated: false,
    });
    setCloseInstantly(instantly);
    setSearching(false);
    setSearch('');
  }, []);

  const openSearch = useCallback(() => {
    setCloseInstantly(false);
    setSearching(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    if (menuActiveRef.current) return;
    closeSearch();
  }, [closeSearch]);

  const handleNavigate = useCallback(() => {
    closeSearch(true);
    navigation.closeDrawer();
  }, [closeSearch, navigation]);

  const handleMenuActiveChange = useCallback((active: boolean) => {
    menuActiveRef.current = active;
    if (!active) inputRef.current?.focus();
  }, []);

  return (
    <View style={styles.container}>
      <View
        style={styles.menu}
        accessibilityElementsHidden={searching}
        importantForAccessibility={searching ? 'no-hide-descendants' : 'auto'}
      >
        <DrawerMenu
          searching={false}
          search=""
          now={now}
          navHeight={navHeight}
          onNavMeasured={setNavHeight}
          onChangeSearch={setSearch}
          onOpenSearch={openSearch}
          onCloseSearch={closeSearch}
          onNavigate={handleNavigate}
          scrollRef={collapsedScrollRef}
          scrollOffsetRef={scrollOffsetRef}
          resetScrollPosition={status === 'closed'}
        />
      </View>

      <DrawerSearchOverlay
        active={searching}
        closeInstantly={closeInstantly}
        search={search}
        now={now}
        navHeight={navHeight}
        onNavMeasured={setNavHeight}
        scrollOffsetRef={scrollOffsetRef}
        onChangeSearch={setSearch}
        onRequestClose={closeSearch}
        onSearchBlur={handleSearchBlur}
        onMenuActiveChange={handleMenuActiveChange}
        onNavigate={handleNavigate}
        inputRef={inputRef}
      />
    </View>
  );
};

export default CustomDrawer;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
      paddingTop: getDrawerTopPadding(theme.insets.top),
    },
    menu: {
      flex: 1,
    },
  });
