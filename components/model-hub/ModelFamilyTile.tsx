import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Model } from '../../database/modelRepository';
import { getModelFamily } from '../../utils/modelFamily';
import {
  UNKNOWN_FAMILY_COLOR,
  familyIcon,
  familyInitial,
} from '../../constants/model-families';
import { radius, space } from '../../constants/design-system';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';

const FAMILY_TILE = {
  badge: { tile: 20, icon: 12, radius: radius.six, initial: 'xxs' },
  row: { tile: 28, icon: 16, radius: radius.six + space.half, initial: 'xs' },
  card: { tile: 44, icon: 24, radius: radius.twelve, initial: 'lg' },
} as const;

export type ModelFamilyTileSize = keyof typeof FAMILY_TILE;

interface Props {
  model: Model;
  size: ModelFamilyTileSize;
  iconColor?: string;
}

const ModelFamilyTile = ({ model, size, iconColor }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles, size);
  const family = getModelFamily(model);
  const FamilyIcon = familyIcon(family);
  const iconSize = FAMILY_TILE[size].icon;

  return (
    <View
      style={[styles.tile, !FamilyIcon && styles.initialTile]}
      testID="model-family-tile"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {FamilyIcon ? (
        <FamilyIcon
          width={iconSize}
          height={iconSize}
          style={{ color: iconColor ?? theme.text.primary }}
          testID="model-family-icon"
        />
      ) : (
        <Text style={styles.initial}>{familyInitial(family)}</Text>
      )}
    </View>
  );
};

export default ModelFamilyTile;

const createStyles = (theme: Theme, size: ModelFamilyTileSize) => {
  const spec = FAMILY_TILE[size];
  return StyleSheet.create({
    tile: {
      width: spec.tile,
      height: spec.tile,
      borderRadius: spec.radius,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.tile,
    },
    initialTile: {
      backgroundColor: theme.label[UNKNOWN_FAMILY_COLOR].background,
    },
    initial: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes[spec.initial],
      lineHeight: lineHeights[spec.initial],
      color: theme.label[UNKNOWN_FAMILY_COLOR].foreground,
    },
  });
};
