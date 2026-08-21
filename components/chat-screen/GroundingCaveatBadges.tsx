import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { type GroundingCaveatKind } from '../../database/chatRepository';

const CAVEAT_COPY: Record<GroundingCaveatKind, string> = {
  figure: "A number here couldn't be confirmed against the sources",
  trend: 'No data on the change over time was found in the sources',
  conversion: 'No real conversion rate was found in the sources',
};

interface Props {
  caveats?: GroundingCaveatKind[];
}

const GroundingCaveatBadges = ({ caveats }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  if (!caveats?.length) return null;

  return (
    <View style={styles.container}>
      {caveats.map((kind) => (
        <View key={kind} style={styles.badge}>
          <Text style={styles.text}>{CAVEAT_COPY[kind]}</Text>
        </View>
      ))}
    </View>
  );
};

export default GroundingCaveatBadges;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 6,
    },
    badge: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 9999,
      backgroundColor: theme.bg.softSecondary,
      borderWidth: 1,
      borderColor: theme.border.soft,
    },
    text: {
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
  });
