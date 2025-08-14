import React, { useMemo } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { Source } from '../../database/sourcesRepository';
import { Theme } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import LockIcon from '../../assets/icons/lock.svg';

interface Props {
  source: Source;
}

const ActivatedSourceCard = ({ source }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.card]}>
      <View style={{ gap: 4 }}>
        <Text style={styles.name}>{source.name}</Text>
      </View>
      <LockIcon
        style={{ color: theme.text.defaultTertiary }}
        width={16}
        height={20}
      />
    </View>
  );
};

export default ActivatedSourceCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      padding: 16,
      borderWidth: 1,
      borderRadius: 12,
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'space-between',
      alignItems: 'center',
      borderColor: theme.border.soft,
    },
    name: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    iconSecondary: {
      color: theme.text.defaultSecondary,
    },
    chipContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
  });
