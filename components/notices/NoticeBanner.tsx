import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme, withAlpha } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import InfoCircleIcon from '../../assets/icons/info-circle.svg';
import WarningIcon from '../../assets/icons/warning-triangle.svg';
import ErrorIcon from '../../assets/icons/cross-circle.svg';
import CloseIcon from '../../assets/icons/close.svg';
import type { AppNotice, NoticeVariant } from '../../store/noticeStore';

const ICON_SIZE = 18;
const CLOSE_ICON_SIZE = 12;
const CLOSE_HIT_SLOP = 12;

const VARIANT_ICONS: Record<NoticeVariant, typeof InfoCircleIcon> = {
  info: InfoCircleIcon,
  warning: WarningIcon,
  error: ErrorIcon,
};

const accentFor = (theme: Theme, variant: NoticeVariant) => {
  switch (variant) {
    case 'info':
      return theme.bg.main;
    case 'warning':
      return theme.text.warning;
    case 'error':
      return theme.text.error;
  }
};

interface Props {
  notice: AppNotice;
  onDismiss: (id: string) => void;
}

const NoticeBanner = ({ notice, onDismiss }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const accent = accentFor(theme, notice.variant);
  const Icon = VARIANT_ICONS[notice.variant];

  const handleDismiss = () => onDismiss(notice.id);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: withAlpha(accent, 0.1),
          borderColor: withAlpha(accent, 0.3),
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      testID={`notice-${notice.id}`}
    >
      <View
        style={[styles.iconBadge, { backgroundColor: withAlpha(accent, 0.16) }]}
      >
        <Icon width={ICON_SIZE} height={ICON_SIZE} color={accent} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{notice.title}</Text>
        {!!notice.message && (
          <Text style={styles.message}>{notice.message}</Text>
        )}
        {notice.action && (
          <Pressable
            onPress={notice.action.onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            testID={`notice-${notice.id}-action`}
          >
            <Text style={[styles.actionLabel, { color: accent }]}>
              {notice.action.label}
            </Text>
          </Pressable>
        )}
      </View>
      {notice.dismissible && (
        <Pressable
          onPress={handleDismiss}
          hitSlop={CLOSE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.pressed,
          ]}
          testID={`notice-${notice.id}-dismiss`}
        >
          <CloseIcon
            width={CLOSE_ICON_SIZE}
            height={CLOSE_ICON_SIZE}
            style={styles.closeIcon}
          />
        </Pressable>
      )}
    </View>
  );
};

export default NoticeBanner;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    iconBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: {
      flex: 1,
      gap: 2,
      paddingTop: 1,
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
    action: {
      alignSelf: 'flex-start',
      marginTop: 6,
      paddingVertical: 4,
    },
    actionLabel: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.sm,
    },
    closeButton: {
      paddingTop: 4,
    },
    closeIcon: {
      color: theme.text.defaultTertiary,
    },
    pressed: {
      opacity: 0.4,
    },
  });
