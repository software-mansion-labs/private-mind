import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import {
  UNKNOWN_FAMILY_COLOR,
  familyIcon,
  familyIconScale,
  familyInitial,
} from '../../constants/model-families';
import { radius, space } from '../../constants/design-system';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';

const FAMILY_TILE = {
  badge: { tile: 20, icon: 12, radius: radius.six, initial: 'xxs' },
  row: { tile: 28, icon: 16, radius: radius.six + space.half, initial: 'xs' },
  list: { tile: 40, icon: 24, radius: radius.twelve, initial: 'lg' },
  card: { tile: 44, icon: 24, radius: radius.twelve, initial: 'lg' },
  hero: { tile: 56, icon: 32, radius: radius.eighteen, initial: 'xl' },
} as const;

export type ModelFamilyTileSize = keyof typeof FAMILY_TILE;

export const familyTileSize = (size: ModelFamilyTileSize): number =>
  FAMILY_TILE[size].tile;

interface Props {
  family: string;
  size: ModelFamilyTileSize;
  iconColor?: string;
  bareIconSize?: number;
}

const ModelFamilyTile = ({ family, size, iconColor, bareIconSize }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles, size);
  const FamilyIcon = familyIcon(family);
  const iconOnly = bareIconSize !== undefined && !!FamilyIcon;
  const iconSize = iconOnly ? bareIconSize : FAMILY_TILE[size].icon;
  const drawnIconSize = iconSize * familyIconScale(family);

  return (
    <View
      style={[
        styles.tile,
        !FamilyIcon && styles.initialTile,
        iconOnly && [styles.bareTile, { width: iconSize, height: iconSize }],
      ]}
      testID="model-family-tile"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {FamilyIcon ? (
        <FamilyIcon
          width={drawnIconSize}
          height={drawnIconSize}
          style={{ color: iconColor ?? theme.text.primary }}
          testID="model-family-icon"
        />
      ) : (
        <Text style={styles.initial} allowFontScaling={false}>
          {familyInitial(family)}
        </Text>
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
    bareTile: {
      backgroundColor: 'transparent',
    },
    initial: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes[spec.initial],
      lineHeight: lineHeights[spec.initial],
      color: theme.label[UNKNOWN_FAMILY_COLOR].foreground,
    },
  });
};
