import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Model } from '../../database/modelRepository';
import { getModelFamily } from '../../utils/modelFamily';
import { space } from '../../constants/design-system';
import CircleButton from '../CircleButton';
import ModelFamilyTile from './ModelFamilyTile';
import ModelRow from './ModelRow';
import ModelRowText from './ModelRowText';
import { ROW_PADDING } from './RowGroup';
import DownloadPercent from './DownloadPercent';
import DownloadProgressBar from './DownloadProgressBar';
import DownloadProgressDetails from './DownloadProgressDetails';
import CloseIcon from '../../assets/icons/close.svg';

interface Props {
  model: Model;
  progress: number;
  rate?: number;
  onCancel: (model: Model) => void;
}

const DownloadingModelRow = ({ model, progress, rate, onCancel }: Props) => {
  const { theme } = useTheme();

  return (
    <ModelRow align="top" style={styles.row} testID="downloading-model-row">
      <ModelFamilyTile family={getModelFamily(model)} size="list" />
      <ModelRowText
        title={model.modelName}
        titleAccessory={<DownloadPercent progress={progress} />}
        accessoryPlacement="end"
        style={styles.text}
      >
        <DownloadProgressBar
          progress={progress}
          accessibilityLabel={`${model.modelName} download progress`}
        />
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

const styles = StyleSheet.create({
  row: {
    padding: ROW_PADDING,
  },
  text: {
    gap: space.two,
  },
});
