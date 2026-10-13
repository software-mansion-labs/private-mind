import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { ThemeProvider } from '../../context/ThemeContext';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { bySeverity, useNoticeStore } from '../../store/noticeStore';
import NoticeBanner from './NoticeBanner';

const STACK_GAP = 8;

interface Props {
  children: ReactNode;
}

const NoticeHost = ({ children }: Props) => {
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
          {bySeverity(notices).map((notice) => (
            <NoticeBanner
              key={notice.id}
              notice={notice}
              onDismiss={dismissNotice}
            />
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

export default NoticeHost;

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
    content: {
      flex: 1,
    },
  });
