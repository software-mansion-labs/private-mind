import { useCallback, useMemo, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import {
  USER_ACTION_MENU_OFFSET,
  USER_MESSAGE_BOTTOM_SPACING,
} from '../../constants/chat-screen';
import type { UserMessageActionMenuState } from './Messages';

interface UseChatScreenLayoutOptions {
  headerTitleBottom?: number;
  headerHeight: number;
}

export const useChatScreenLayout = ({
  headerTitleBottom,
  headerHeight,
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

  return {
    rootRef,
    rootFrame,
    handleRootLayout,
    userActionMenu,
    setUserActionMenu,
    userActionMenuPosition,
    fadeBottom,
    topFadeAnchor,
  };
};
