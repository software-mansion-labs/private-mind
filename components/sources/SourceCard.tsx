import React, { useMemo } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { Source } from '../../database/sourcesRepository';
import { Theme } from '../../styles/colors';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import Chip from '../Chip';
import SourceIcon from '../../assets/icons/source.svg';

interface Props {
  source: Source;
  actionButton?: React.ReactNode;
}

const SourceCard = ({ source, actionButton }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <View style={styles.content}>
        <Text style={styles.name}>{source.name}</Text>
        <View style={styles.chipContainer}>
          {source.size && (
            <Chip
              borderColor={theme.border.soft}
              title={`${(source.size / 1_000_000).toFixed(2)} MB`}
            />
          )}
          <Chip
            borderColor={theme.border.soft}
            title={`${source.type.toUpperCase()}`}
            icon={
              <SourceIcon width={12} height={12} style={styles.iconSecondary} />
            }
          />
        </View>
      </View>
      {actionButton && <>{actionButton}</>}
    </View>
  );
};

export default SourceCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      padding: 16,
      borderWidth: 1,
      borderRadius: 12,
      borderColor: theme.border.soft,
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    content: {
      gap: 4,
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
  });
