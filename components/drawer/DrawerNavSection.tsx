import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from '../../context/ThemeContext';
import { useChatStore } from '../../store/chatStore';
import { useLLMStore } from '../../store/llmStore';
import { startPhantomChat } from '../../utils/startPhantomChat';
import { Theme } from '../../styles/colors';
import ChatIcon from '../../assets/icons/chat.svg';
import ModelsIcon from '../../assets/icons/models.svg';
import SettingsIcon from '../../assets/icons/settings.svg';
import { DrawerItem } from './DrawerItem';
import {
  EMPHASIZED_STANDARD,
  NAV_COLLAPSE_DURATION,
  SECTION_GAP,
} from '../../constants/drawer-layout';

const NAV_EASING = Easing.bezier(...EMPHASIZED_STANDARD);

interface Props {
  collapsed: boolean;
  height: number;
  onMeasured: (height: number) => void;
  onNavigate?: () => void;
}

export const DrawerNavSection = ({
  collapsed,
  height,
  onMeasured,
  onNavigate,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const router = useRouter();
  const pathname = usePathname();
  const db = useSQLiteContext();
  const { phantomChat } = useChatStore();
  const { interrupt } = useLLMStore();

  const isOnPhantomChat =
    phantomChat != null && pathname === `/chat/${phantomChat.id}`;

  const [rendered, setRendered] = useState(!collapsed);
  const progress = useSharedValue(collapsed ? 0 : 1);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    if (!collapsed) {
      setRendered(true);
      progress.set(
        withTiming(1, {
          duration: NAV_COLLAPSE_DURATION,
          easing: NAV_EASING,
        })
      );
      return;
    }

    progress.set(
      withTiming(
        0,
        { duration: NAV_COLLAPSE_DURATION, easing: NAV_EASING },
        (finished) => {
          if (finished) runOnJS(setRendered)(false);
        }
      )
    );
  }, [collapsed, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!height) return {};

    return {
      height: interpolate(progress.get(), [0, 1], [0, height]),
      marginBottom: interpolate(progress.get(), [0, 1], [0, SECTION_GAP]),
      opacity: progress.get(),
    };
  }, [height]);

  if (!rendered) return null;

  return (
    <Animated.View
      style={[styles.wrapper, animatedStyle]}
      pointerEvents={collapsed ? 'none' : 'auto'}
    >
      <View
        style={styles.section}
        onLayout={
          height
            ? undefined
            : (event) => {
                const measured = event.nativeEvent.layout.height;
                if (measured > 0) onMeasured(measured);
              }
        }
      >
        <DrawerItem
          icon={<ChatIcon width={18} height={18} style={styles.icon} />}
          label="New chat"
          testID="drawer-new-chat"
          active={pathname === '/' || isOnPhantomChat}
          onPress={() => {
            if (isOnPhantomChat) {
              onNavigate?.();
              return;
            }
            interrupt();
            startPhantomChat(db, 'replace');
            onNavigate?.();
          }}
        />
        <DrawerItem
          icon={<ModelsIcon width={18} height={18} style={styles.icon} />}
          label="Models"
          active={pathname === '/model-hub'}
          onPress={() => {
            interrupt();
            router.replace('/model-hub');
            onNavigate?.();
          }}
        />
        <DrawerItem
          icon={<SettingsIcon width={18} height={18} style={styles.icon} />}
          label="Settings"
          active={pathname === '/settings'}
          onPress={() => {
            interrupt();
            router.replace('/settings');
            onNavigate?.();
          }}
        />
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    wrapper: {
      overflow: 'hidden',
      marginBottom: SECTION_GAP,
    },
    section: {
      gap: 8,
    },
    icon: {
      color: theme.text.primary,
    },
  });
