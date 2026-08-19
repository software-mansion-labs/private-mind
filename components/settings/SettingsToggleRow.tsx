import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { ThemedSwitch } from '../ThemedSwitch';

interface Props {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export const SettingsToggleRow = ({
  label,
  description,
  icon,
  value,
  onValueChange,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      {icon}
      <View style={styles.texts}>
        <Text numberOfLines={1} style={styles.label}>
          {label}
        </Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <ThemedSwitch value={value} onValueChange={onValueChange} />
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.bg.softSecondary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    texts: {
      flex: 1,
      gap: 2,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    description: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
  });
