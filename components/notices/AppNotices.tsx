import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { ThemeProvider } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useNoticeStore } from '../../store/noticeStore';
import { pressedOpacity } from '../../styles/pressable';
import CloseIcon from '../../assets/icons/close.svg';

const STACK_GAP = 8;
const DISMISS_HIT_SLOP = 12;

interface Props {
  children: ReactNode;
}

const AppNotices = ({ children }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const notices = useNoticeStore((state) => state.notices);
  const dismissNotice = useNoticeStore((state) => state.dismissNotice);
  const insets = useSafeAreaInsets();
  const hasNotices = notices.length > 0;
  const contentInsets = hasNotices ? { ...insets, top: 0 } : insets;

  return (
    <View style={styles.root}>
      {hasNotices && (
        <View
          style={[styles.stack, { paddingTop: insets.top + STACK_GAP }]}
          testID="notice-stack"
        >
          {notices.map((notice) => (
            <View
              key={notice.id}
              style={styles.card}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              testID={`notice-${notice.id}`}
            >
              <View
                style={styles.badge}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Text style={styles.badgeMark}>!</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.title}>{notice.title}</Text>
                {!!notice.message && (
                  <Text style={styles.message}>{notice.message}</Text>
                )}
              </View>
              {!!notice.onDismiss && (
                <Pressable
                  onPress={() => dismissNotice(notice)}
                  hitSlop={DISMISS_HIT_SLOP}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss"
                  style={({ pressed }) => [
                    styles.dismiss,
                    pressed && pressedOpacity,
                  ]}
                  testID={`notice-${notice.id}-dismiss`}
                >
                  <CloseIcon
                    width={13.33}
                    height={13.33}
                    style={styles.dismissIcon}
                  />
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
      <SafeAreaInsetsContext.Provider value={contentInsets}>
        <ThemeProvider>
          <View style={styles.content}>{children}</View>
        </ThemeProvider>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
};

export default AppNotices;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    stack: {
      gap: STACK_GAP,
      paddingHorizontal: 12,
      paddingBottom: STACK_GAP,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border.soft,
      backgroundColor: theme.bg.cardSurface,
    },
    badge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.text.warning,
    },
    badgeMark: {
      color: theme.bg.softPrimary,
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
    },
    copy: {
      flex: 1,
      gap: 2,
      paddingTop: 2,
    },
    title: {
      color: theme.text.primary,
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
    },
    message: {
      color: theme.text.defaultSecondary,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
    },
    dismiss: {
      paddingTop: 4,
    },
    dismissIcon: {
      color: theme.text.primary,
    },
    content: {
      flex: 1,
    },
  });
