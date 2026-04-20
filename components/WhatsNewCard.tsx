import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../styles/fontStyles';
import { LATEST_RELEASE } from '../constants/latest-release';

const WhatsNewCard = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.badge}>What's new</Text>
        <Text style={styles.version}>v{LATEST_RELEASE.version}</Text>
      </View>
      <Text style={styles.title}>{LATEST_RELEASE.title}</Text>
      <View style={styles.list}>
        {LATEST_RELEASE.highlights.map((item, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.item}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default WhatsNewCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      width: '100%',
      backgroundColor: theme.bg.cardSurface,
      borderRadius: 16,
      padding: 16,
      gap: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    badge: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      color: theme.bg.main,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    version: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      color: theme.text.defaultTertiary,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.lg,
      lineHeight: lineHeights.lg,
      color: theme.text.primary,
    },
    list: {
      gap: 6,
    },
    row: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
    },
    bullet: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.bg.main,
    },
    item: {
      flex: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultSecondary,
    },
  });
