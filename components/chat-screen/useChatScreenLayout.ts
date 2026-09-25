import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import {
  Easing,
  interpolate,
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

const GRADIENT_ENTER_MS = 520;
const GRADIENT_EXIT_MS = 320;
const GRADIENT_UNMOUNT_SLACK_MS = 100;
const GRADIENT_DRIFT_PX = 28;
const GRADIENT_ENTER_SCALE = 1.05;

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
  const { width: windowWidth } = useWindowDimensions();

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
  const [showGradient, setShowGradient] = useState(isEmpty);
  useEffect(() => {
    gradientProgress.set(
      isEmpty
        ? withTiming(1, {
            duration: GRADIENT_ENTER_MS,
            easing: Easing.out(Easing.cubic),
          })
        : withTiming(0, {
            duration: GRADIENT_EXIT_MS,
            easing: Easing.in(Easing.cubic),
          })
    );
    if (isEmpty) {
      setShowGradient(true);
      return;
    }
    const timer = setTimeout(
      () => setShowGradient(false),
      GRADIENT_EXIT_MS + GRADIENT_UNMOUNT_SLACK_MS
    );
    return () => clearTimeout(timer);
  }, [isEmpty, gradientProgress]);
  const gradientStyle = useAnimatedStyle(() => ({
    opacity: gradientProgress.get(),
    transform: [
      { translateY: (1 - gradientProgress.get()) * GRADIENT_DRIFT_PX },
      {
        scale: interpolate(
          gradientProgress.get(),
          [0, 1],
          [GRADIENT_ENTER_SCALE, 1]
        ),
      },
    ],
  }));
  const topFadeStyle = useAnimatedStyle(() => ({
    opacity: gradientProgress.get(),
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
    topFadeStyle,
    showGradient,
    fadeBottom,
    topFadeAnchor,
    emptyFadeColors,
  };
};
