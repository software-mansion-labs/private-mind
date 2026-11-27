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
  testID?: string;
}

export const SettingsToggleRow = ({
  label,
  description,
  icon,
  value,
  onValueChange,
  testID,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.row}>
      {icon && (
        <View style={[styles.iconSlot, description && styles.iconOnLabelLine]}>
          {icon}
        </View>
      )}
      <View style={styles.texts}>
        <Text style={styles.label}>{label}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <ThemedSwitch
        value={value}
        onValueChange={onValueChange}
        testID={testID}
      />
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
    iconSlot: {
      height: lineHeights.md,
      justifyContent: 'center',
    },
    iconOnLabelLine: {
      alignSelf: 'flex-start',
    },
    texts: {
      flex: 1,
      gap: space.half,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
    description: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
  });
