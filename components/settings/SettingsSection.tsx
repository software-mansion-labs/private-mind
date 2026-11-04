import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { space } from '../../constants/design-system';

interface Props {
  title: string;
  children: React.ReactNode;
  fill?: boolean;
}

export const SettingsSection = ({ title, children, fill = false }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={[styles.section, fill && styles.fill]}>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.rows, fill && styles.fill]}>{children}</View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: space.two,
    },
    title: {
      alignSelf: 'flex-start',
      paddingHorizontal: space.three,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      letterSpacing: 0.1,
      color: theme.text.defaultTertiary,
    },
    rows: {
      gap: space.two,
    },
    fill: {
      flex: 1,
    },
  });
