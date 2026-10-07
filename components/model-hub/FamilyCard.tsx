import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { ModelFamily } from '../../utils/modelFamily';
import Chip from '../Chip';
import { familyIcon, MODEL_FAMILIES } from '../../constants/model-families';
import {
  iconSize,
  opacity,
  radius,
  space,
} from '../../constants/design-system';
import ChevronRightIcon from '../../assets/icons/chevron-right.svg';
import { ROW_PADDING, ROW_TILE_SIZE } from './RowGroup';

interface Props {
  family: ModelFamily;
  onPress: (family: ModelFamily) => void;
  runnable?: boolean;
}

const CHEVRON_WIDTH = 8;
const CHEVRON_HEIGHT = 14;

const pluralize = (count: number, noun: string) =>
  `${count} ${count === 1 ? noun : `${noun}s`}`;

const familyCounts = (family: ModelFamily) => {
  const variants = pluralize(family.models.length, 'variant');
  const downloaded = family.models.filter((m) => m.isDownloaded).length;
  return downloaded > 0 ? `${variants} · ${downloaded} downloaded` : variants;
};

const FamilyCard = ({ family, onPress, runnable = true }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  const info = MODEL_FAMILIES[family.name];
  const Icon = familyIcon(family.name);

  return (
    <TouchableOpacity
      style={[styles.row, !runnable && styles.unrunnableRow]}
      onPress={() => onPress(family)}
      activeOpacity={opacity.pressed}
      testID={`family-card-${family.name}`}
    >
      <View style={styles.tile}>
        <Icon
          width={iconSize.lg}
          height={iconSize.lg}
          style={styles.icon}
          testID={`family-icon-${family.name}`}
        />
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {family.name}
          </Text>
          {!runnable && (
            <Chip
              title="Incompatible"
              borderColor={theme.text.error}
              backgroundColor={theme.bg.errorSecondary}
              textColor={theme.text.error}
            />
          )}
        </View>
        {info && (
          <Text style={styles.summary} numberOfLines={1}>
            {`${info.provider} · ${info.summary}`}
          </Text>
        )}
        <Text style={styles.counts}>{familyCounts(family)}</Text>
      </View>
      <ChevronRightIcon
        width={CHEVRON_WIDTH}
        height={CHEVRON_HEIGHT}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
};

export default FamilyCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ROW_PADDING,
      paddingHorizontal: ROW_PADDING,
      paddingVertical: space.twoHalf,
    },
    unrunnableRow: {
      opacity: opacity.disabled,
    },
    tile: {
      width: ROW_TILE_SIZE,
      height: ROW_TILE_SIZE,
      borderRadius: radius.twelve,
      backgroundColor: theme.bg.softSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      color: theme.text.primary,
    },
    info: {
      flex: 1,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.two,
    },
    name: {
      flexShrink: 1,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
    summary: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultSecondary,
    },
    counts: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
    chevron: {
      color: theme.text.defaultTertiary,
    },
  });
