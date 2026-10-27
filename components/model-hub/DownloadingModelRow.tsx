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
import ModelRow from './ModelRow';
import ModelRowText from './ModelRowText';
import { ROW_PADDING } from './RowGroup';
import DownloadProgressDetails from './DownloadProgressDetails';
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

  return (
    <ModelRow align="top" style={styles.row} testID="downloading-model-row">
      <ModelFamilyTile family={getModelFamily(model)} size="list" />
      <ModelRowText
        title={model.modelName}
        titleAccessory={<Text style={styles.percent}>{percent}%</Text>}
        accessoryPlacement="end"
        style={styles.text}
      >
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityLabel={`${model.modelName} download progress`}
          accessibilityValue={{ min: 0, max: 100, now: percent }}
        >
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
        <DownloadProgressDetails
          modelSize={model.modelSize}
          progress={progress}
          rate={rate}
        />
      </ModelRowText>
      <CircleButton
        onPress={() => onCancel(model)}
        backgroundColor={theme.bg.tile}
        color={theme.text.primary}
        icon={CloseIcon}
        size={13.33}
        testID="downloading-model-cancel"
      />
    </ModelRow>
  );
};

export default DownloadingModelRow;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      padding: ROW_PADDING,
    },
    text: {
      gap: space.two,
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
  });
