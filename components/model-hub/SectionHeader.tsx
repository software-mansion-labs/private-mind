import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { space, textStyles } from '../../constants/design-system';

interface Props {
  title: string;
  summary?: string;
}

const SectionHeader = ({ title, summary }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {summary ? <Text style={styles.summary}>{summary}</Text> : null}
    </View>
  );
};

export default SectionHeader;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      columnGap: space.two,
      paddingHorizontal: space.one,
    },
    title: {
      flexShrink: 1,
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultSecondary,
    },
    summary: {
      ...textStyles.bodyTertiaryRegular,
      color: theme.text.defaultTertiary,
    },
  });
