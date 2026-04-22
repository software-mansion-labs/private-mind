import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { ModelFamily } from '../../utils/modelFamily';
import Chip from '../Chip';
import { FAMILY_DESCRIPTIONS } from '../../constants/family-descriptions';

interface Props {
  family: ModelFamily;
  onPress: (family: ModelFamily) => void;
}

const FamilyCard = ({ family, onPress }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const downloadedCount = family.models.filter((m) => m.isDownloaded).length;
  const variantCount = family.models.length;
  const description = FAMILY_DESCRIPTIONS[family.name];

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(family)}>
      <View style={styles.info}>
        <Text style={styles.name}>{family.name}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
        <View style={styles.chipContainer}>
          <Chip
            title={`${variantCount} ${variantCount === 1 ? 'variant' : 'variants'}`}
            borderColor={theme.border.soft}
          />
          {downloadedCount > 0 && (
            <Chip
              title={`${downloadedCount} downloaded`}
              borderColor={theme.border.soft}
            />
          )}
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
};

export default FamilyCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      padding: 16,
      borderWidth: 1,
      borderRadius: 12,
      borderColor: theme.border.soft,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    info: {
      flex: 1,
      gap: 8,
    },
    name: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    description: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultSecondary,
      lineHeight: 20,
    },
    chipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    chevron: {
      fontSize: 28,
      fontFamily: fontFamily.regular,
      color: theme.bg.main,
      lineHeight: 28,
    },
  });
