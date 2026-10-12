import React from 'react';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import InfoCircleIcon from '../assets/icons/info-circle.svg';
import { fontFamily, fontSizes } from '../styles/fontStyles';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';

export type InfoAlertVariant = 'info' | 'warning' | 'danger';

interface Props {
  text: string;
  title?: string;
  variant?: InfoAlertVariant;
  action?: { label: string; onPress: () => void };
  onDismiss?: () => void;
  dismissLabel?: string;
  testID?: string;
}

export const InfoAlert = ({
  text,
  title,
  variant = 'info',
  action,
  onDismiss,
  dismissLabel = 'Dismiss',
  testID,
}: Props) => {
  const { styles } = useThemedStyles(createStyles, variant);
  const hasFooter = !!action || !!onDismiss;

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.row}>
        <InfoCircleIcon
          width={20}
          height={20}
          fillOpacity={0.6}
          style={styles.icon}
        />
        <View style={styles.textWrapper}>
          {title && <Text style={styles.title}>{title}</Text>}
          <Text style={styles.alertText}>{text}</Text>
        </View>
      </View>
      {hasFooter && (
        <View style={styles.footer}>
          {action && (
            <TouchableOpacity
              onPress={action.onPress}
              style={styles.actionButton}
              testID={testID ? `${testID}-action` : undefined}
            >
              <Text style={styles.actionText}>{action.label}</Text>
            </TouchableOpacity>
          )}
          {onDismiss && (
            <TouchableOpacity
              onPress={onDismiss}
              style={styles.dismissButton}
              testID={testID ? `${testID}-dismiss` : undefined}
            >
              <Text style={styles.dismissText}>{dismissLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const accentOf = (theme: Theme, variant: InfoAlertVariant) => {
  switch (variant) {
    case 'warning':
      return { accent: theme.text.warning, surface: theme.bg.warningSecondary };
    case 'danger':
      return { accent: theme.text.error, surface: theme.bg.errorSecondary };
    default:
      return { accent: theme.text.primary, surface: 'transparent' };
  }
};

const createStyles = (theme: Theme, variant: InfoAlertVariant) => {
  const { accent, surface } = accentOf(theme, variant);
  return StyleSheet.create({
    container: {
      borderRadius: 4,
      padding: 12,
      gap: 12,
      borderWidth: 1,
      borderColor: variant === 'info' ? theme.border.soft : accent,
      backgroundColor: surface,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    icon: {
      color: accent,
    },
    textWrapper: {
      paddingRight: 12,
      flex: 1,
      gap: 4,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: accent,
    },
    alertText: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 8,
    },
    actionButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 100,
      backgroundColor: accent,
    },
    actionText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.contrastPrimary,
    },
    dismissButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    dismissText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
  });
};
