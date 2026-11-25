import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { space } from '../../constants/design-system';
import { SETTINGS_ROW_HEIGHT } from './SettingsRow';
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
    <View style={styles.row}>
      {icon}
      <View style={styles.texts}>
        <Text style={styles.label}>{label}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <ThemedSwitch value={value} onValueChange={onValueChange} />
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      minHeight: SETTINGS_ROW_HEIGHT,
      paddingVertical: space.three,
      paddingHorizontal: space.four,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
    },
    texts: {
      flex: 1,
      gap: space.half,
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
