import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { radius, space } from '../../constants/design-system';
import BuildingIcon from '../../assets/icons/building.svg';

const ICON_TILE_SIZE = 28;
const ICON_SIZE = 16;

interface Props {
  provider: string;
}

const FamilyProviderRow = ({ provider }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`Made by ${provider}`}
      testID="family-provider-row"
    >
      <View style={styles.iconTile}>
        <BuildingIcon
          width={ICON_SIZE}
          height={ICON_SIZE}
          color={theme.label.periwinkle.foreground}
        />
      </View>
      <Text style={styles.text}>
        <Text style={styles.label}>Made by </Text>
        <Text style={styles.value}>{provider}</Text>
      </Text>
    </View>
  );
};

export default FamilyProviderRow;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
      padding: space.three,
      borderRadius: radius.twelve,
      backgroundColor: theme.bg.softTertiary,
    },
    iconTile: {
      width: ICON_TILE_SIZE,
      height: ICON_TILE_SIZE,
      borderRadius: radius.six + space.half,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.label.periwinkle.background,
    },
    text: {
      flexShrink: 1,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
    },
    label: {
      fontFamily: fontFamily.regular,
      color: theme.text.defaultTertiary,
    },
    value: {
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
  });
