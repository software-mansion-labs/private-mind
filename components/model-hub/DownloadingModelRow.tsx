import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Model } from '../../database/modelRepository';
import { getModelFamily } from '../../utils/modelFamily';
import { radius, space } from '../../constants/design-system';
import CircleButton from '../CircleButton';
import ModelFamilyTile from './ModelFamilyTile';
import { ROW_PADDING } from './RowGroup';
import { formatTimeLeft, secondsLeft } from '../../utils/downloadEta';
import CloseIcon from '../../assets/icons/close.svg';

const PROGRESS_TRACK_HEIGHT = 6;
const PERCENT_MIN_WIDTH = 40;

interface Props {
  model: Model;
  progress: number;
  rate?: number;
  onCancel: (model: Model) => void;
}

const DownloadingModelRow = ({ model, progress, rate, onCancel }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const percent = Math.floor(progress * 100);
  const remaining = secondsLeft(progress, rate);

  return (
    <View style={styles.row} testID="downloading-model-row">
      <ModelFamilyTile family={getModelFamily(model)} size="list" />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {model.modelName}
          </Text>
          <Text style={styles.percent}>{percent}%</Text>
        </View>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityLabel={`${model.modelName} download progress`}
          accessibilityValue={{ min: 0, max: 100, now: percent }}
        >
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.detailsRow}>
          {model.modelSize ? (
            <Text style={styles.bytes} numberOfLines={1}>
              {(model.modelSize * progress).toFixed(2)} of{' '}
              {model.modelSize.toFixed(2)} GB
            </Text>
          ) : null}
          {remaining !== undefined && (
            <Text style={styles.timeLeft} testID="downloading-model-time-left">
              {formatTimeLeft(remaining)}
            </Text>
          )}
        </View>
      </View>
      <CircleButton
        onPress={() => onCancel(model)}
        backgroundColor={theme.bg.tile}
        color={theme.text.primary}
        icon={CloseIcon}
        size={13.33}
        testID="downloading-model-cancel"
      />
    </View>
  );
};

export default DownloadingModelRow;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.three,
      padding: ROW_PADDING,
    },
    info: {
      flex: 1,
      minWidth: 0,
      gap: space.two,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: space.two,
    },
    name: {
      flexShrink: 1,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
    percent: {
      minWidth: PERCENT_MIN_WIDTH,
      textAlign: 'right',
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      fontVariant: ['tabular-nums'],
      color: theme.text.accent,
    },
    track: {
      height: PROGRESS_TRACK_HEIGHT,
      borderRadius: radius.full,
      overflow: 'hidden',
      backgroundColor: theme.bg.tile,
    },
    fill: {
      height: '100%',
      borderRadius: radius.full,
      backgroundColor: theme.bg.main,
    },
    detailsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      columnGap: space.two,
      minHeight: lineHeights.xs,
    },
    bytes: {
      flexShrink: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      fontVariant: ['tabular-nums'],
      color: theme.text.defaultTertiary,
    },
    timeLeft: {
      flexShrink: 1,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      fontVariant: ['tabular-nums'],
      color: theme.text.defaultSecondary,
    },
  });
