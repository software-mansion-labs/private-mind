import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { mixColors, Theme } from '../../styles/colors';
import {
  USER_ACTION_MENU_OFFSET,
  USER_MESSAGE_BOTTOM_SPACING,
} from '../../constants/chat-screen';
import type { UserMessageActionMenuState } from './Messages';

interface UseChatScreenLayoutOptions {
  isEmpty: boolean;
  headerTitleBottom?: number;
  headerHeight: number;
  theme: Theme;
}

export const useChatScreenLayout = ({
  isEmpty,
  headerTitleBottom,
  headerHeight,
  theme,
}: UseChatScreenLayoutOptions) => {
  const rootRef = useRef<View>(null);
  const [rootFrame, setRootFrame] = useState({ x: 0, y: 0, height: 0 });
  const [userActionMenu, setUserActionMenu] =
    useState<UserMessageActionMenuState>({ isOpen: false });
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  const handleRootLayout = useCallback(() => {
    rootRef.current?.measureInWindow((x, y, _width, height) => {
      setRootFrame((current) =>
        current.x === x && current.y === y && current.height === height
          ? current
          : { x, y, height }
      );
    });
  }, []);

  const gradientProgress = useSharedValue(isEmpty ? 1 : 0);
  useEffect(() => {
    gradientProgress.set(withTiming(isEmpty ? 1 : 0, { duration: 900 }));
  }, [isEmpty, gradientProgress]);
  const gradientStyle = useAnimatedStyle(() => ({
    opacity: gradientProgress.get(),
    transform: [{ translateY: (1 - gradientProgress.get()) * windowHeight }],
  }));

  const userActionMenuPosition = useMemo(() => {
    if (!userActionMenu.isOpen || !userActionMenu.anchor) return null;

    return {
      top:
        userActionMenu.anchor.y -
        rootFrame.y +
        userActionMenu.anchor.height -
        USER_MESSAGE_BOTTOM_SPACING +
        USER_ACTION_MENU_OFFSET,
      right: Math.max(
        16,
        windowWidth -
          rootFrame.x -
          (userActionMenu.anchor.x + userActionMenu.anchor.width)
      ),
    };
  }, [rootFrame.x, rootFrame.y, userActionMenu, windowWidth]);

  const fadeBottom =
    headerTitleBottom !== undefined
      ? headerTitleBottom - rootFrame.y
      : undefined;
  const topFadeAnchor = fadeBottom ?? headerHeight;
  const emptyFadeColors = useMemo(() => {
    const sample = (y: number) =>
      mixColors(
        theme.bg.softPrimary,
        theme.bg.main,
        rootFrame.height > 0 ? y / rootFrame.height : 0
      );
    return [sample(0), sample(topFadeAnchor)] as const;
  }, [rootFrame.height, theme.bg.main, theme.bg.softPrimary, topFadeAnchor]);

  return {
    rootRef,
    rootFrame,
    handleRootLayout,
    userActionMenu,
    setUserActionMenu,
    userActionMenuPosition,
    gradientStyle,
    fadeBottom,
    topFadeAnchor,
    emptyFadeColors,
  };
};
