import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';

interface Props {
  title: string;
  children: React.ReactNode;
}

export const SettingsSection = ({ title, children }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.rows}>{children}</View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: 8,
    },
    title: {
      alignSelf: 'flex-start',
      paddingHorizontal: 4,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      letterSpacing: 0.1,
      color: theme.text.defaultTertiary,
    },
    rows: {
      gap: 8,
    },
  });
