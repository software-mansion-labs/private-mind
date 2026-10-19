import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { radius, space, textStyles } from '../../constants/design-system';
import { ModelFamily, familyLabels } from '../../utils/modelFamily';
import { FAMILY_SUMMARIES } from '../../constants/family-descriptions';
import ModelFamilyTile from './ModelFamilyTile';
import ModelBadge from './ModelBadge';
import { dimmedOpacity } from '../../styles/pressable';
import CheckIcon from '../../assets/icons/check.svg';
import ChevronRightIcon from '../../assets/icons/chevron-right.svg';

const MAX_LABELS = 5;
const TRAILING_WIDTH = 20;
const CHECK_SIZE = 20;
const CHECK_ICON_SIZE = 12;
const CHEVRON_WIDTH = 8;
const CHEVRON_HEIGHT = 14;

interface Props {
  family: ModelFamily;
  onPress: (family: ModelFamily) => void;
  runnable?: boolean;
}

const pluralize = (count: number, noun: string) =>
  `${count} ${count === 1 ? noun : `${noun}s`}`;

const FamilyCard = ({ family, onPress, runnable = true }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const downloadedCount = family.models.filter((m) => m.isDownloaded).length;
  const variants = pluralize(family.models.length, 'variant');
  const counts =
    downloadedCount > 0
      ? `${variants} · ${downloadedCount} downloaded`
      : variants;
  const summary = FAMILY_SUMMARIES[family.name];
  const labels = familyLabels(family);
  const hiddenLabelCount = labels.length - MAX_LABELS;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
        !runnable && dimmedOpacity,
      ]}
      onPress={() => onPress(family)}
      accessibilityRole="button"
      accessibilityLabel={
        downloadedCount > 0
          ? `${family.name}, ${downloadedCount} downloaded`
          : family.name
      }
      testID={`family-card-${family.name}`}
    >
      <View style={styles.tile}>
        <ModelFamilyTile family={family.name} size="list" />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {family.name}
        </Text>
        {summary && (
          <Text style={styles.summary} numberOfLines={1}>
            {summary}
          </Text>
        )}
        {(!runnable || labels.length > 0) && (
          <View style={styles.labels}>
            {!runnable && <ModelBadge label="Incompatible" color="error" />}
            {labels.slice(0, MAX_LABELS).map((label) => (
              <ModelBadge key={label} label={label} />
            ))}
            {hiddenLabelCount > 0 && (
              <ModelBadge label={`+${hiddenLabelCount}`} color="neutral" />
            )}
          </View>
        )}
        <Text style={styles.counts}>{counts}</Text>
      </View>
      <View style={styles.trailing}>
        {downloadedCount > 0 && (
          <View style={styles.check} testID="family-card-downloaded">
            <CheckIcon
              width={CHECK_ICON_SIZE}
              height={CHECK_ICON_SIZE}
              style={styles.checkIcon}
            />
          </View>
        )}
        <ChevronRightIcon
          width={CHEVRON_WIDTH}
          height={CHEVRON_HEIGHT}
          style={styles.chevron}
        />
      </View>
    </Pressable>
  );
};

export default FamilyCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.four,
      padding: space.five,
      paddingLeft: space.four,
    },
    pressed: {
      backgroundColor: theme.bg.softTertiary,
    },
    tile: {
      alignSelf: 'flex-start',
      marginTop: space.half,
    },
    info: {
      flex: 1,
    },
    name: {
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
    labels: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.one,
      marginTop: space.two,
    },
    counts: {
      ...textStyles.bodyTertiaryRegular,
      marginTop: space.two,
      color: theme.text.defaultTertiary,
    },
    trailing: {
      width: TRAILING_WIDTH,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
    },
    check: {
      position: 'absolute',
      top: space.half,
      width: CHECK_SIZE,
      height: CHECK_SIZE,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.success,
    },
    checkIcon: {
      color: theme.text.onSuccess,
    },
    chevron: {
      color: theme.text.defaultTertiary,
    },
  });
