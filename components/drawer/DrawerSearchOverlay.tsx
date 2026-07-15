import React, { RefObject, useCallback, useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {
  GestureHandlerRootView,
  Pressable,
} from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import DrawerMenu from './DrawerMenu';
import { useSearchOverlayAnimation } from './useSearchOverlayAnimation';
import {
  getDrawerTopPadding,
  getDrawerWidth,
} from '../../constants/drawer-layout';

interface Props {
  active: boolean;
  closeInstantly: boolean;
  search: string;
  now: number;
  navHeight: number;
  onNavMeasured: (height: number) => void;
  onChangeSearch: (value: string) => void;
  onRequestClose: () => void;
  onSearchBlur: () => void;
  onMenuActiveChange: (active: boolean) => void;
  onNavigate: () => void;
  inputRef: RefObject<TextInput | null>;
  scrollOffsetRef: RefObject<number>;
}

export const DrawerSearchOverlay = ({
  active,
  closeInstantly,
  search,
  now,
  navHeight,
  onNavMeasured,
  onChangeSearch,
  onRequestClose,
  onSearchBlur,
  onMenuActiveChange,
  onNavigate,
  inputRef,
  scrollOffsetRef,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width: screenWidth } = useWindowDimensions();

  const { mounted, progress, contentProgress, backdropOpacity, startExpand } =
    useSearchOverlayAnimation({ active, closeInstantly });
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();

  const collapsedWidth = getDrawerWidth(screenWidth);

  const panelStyle = useAnimatedStyle(() => ({
    width: Math.round(
      interpolate(progress.get(), [0, 1], [collapsedWidth, screenWidth])
    ),
    paddingBottom: -keyboardHeight.get(),
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.get(),
  }));

  const handleBackdropPress = () => {
    Keyboard.dismiss();
    onRequestClose();
  };

  const handleShow = useCallback(() => {
    startExpand();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [startExpand, inputRef]);

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onShow={handleShow}
      onRequestClose={onRequestClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <BottomSheetModalProvider>
          <Animated.View
            style={[styles.backdrop, backdropStyle]}
            pointerEvents="none"
          />
          <Pressable
            style={styles.backdropTouch}
            onPress={handleBackdropPress}
          />
          <Animated.View style={[styles.panel, panelStyle]}>
            <View style={styles.panelContent}>
              <DrawerMenu
                searching
                search={search}
                now={now}
                navHeight={navHeight}
                onNavMeasured={onNavMeasured}
                onChangeSearch={onChangeSearch}
                onCloseSearch={onRequestClose}
                onSearchBlur={onSearchBlur}
                onMenuActiveChange={onMenuActiveChange}
                onNavigate={onNavigate}
                inputRef={inputRef}
                scrollOffsetRef={scrollOffsetRef}
                searchProgress={contentProgress}
              />
            </View>
          </Animated.View>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.bg.softPrimary,
    },
    backdropTouch: {
      ...StyleSheet.absoluteFillObject,
    },
    panel: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      overflow: 'hidden',
      backgroundColor: theme.bg.softPrimary,
      paddingTop: getDrawerTopPadding(theme.insets.top),
    },
    panelContent: {
      flex: 1,
    },
  });
