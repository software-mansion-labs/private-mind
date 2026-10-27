import React from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Model } from '../../database/modelRepository';
import { getModelFamily } from '../../utils/modelFamily';
import { formatGB } from '../../utils/modelMeta';
import CircleButton from '../CircleButton';
import ModelFamilyTile from './ModelFamilyTile';
import DownloadedBadge from './DownloadedBadge';
import ModelRow from './ModelRow';
import ModelRowText from './ModelRowText';
import { ROW_PADDING } from './RowGroup';
import TrashIcon from '../../assets/icons/trash.svg';

interface Props {
  model: Model;
  onDelete?: (model: Model) => void;
  onPress?: (model: Model) => void;
}

const DownloadedModelRow = ({ model, onDelete, onPress }: Props) => {
  const { theme } = useTheme();

  return (
    <ModelRow
      style={styles.row}
      onPress={onPress ? () => onPress(model) : undefined}
      accessibilityRole="button"
      accessibilityLabel={model.modelName}
      testID="downloaded-model-row"
    >
      <ModelFamilyTile family={getModelFamily(model)} size="list" />
      <ModelRowText
        title={model.modelName}
        titleAccessory={<DownloadedBadge />}
        subtitle={model.modelSize ? formatGB(model.modelSize) : undefined}
      />
      {onDelete && (
        <CircleButton
          onPress={() => onDelete(model)}
          backgroundColor={theme.bg.errorSecondary}
          color={theme.text.error}
          icon={TrashIcon}
          size={16}
          testID="downloaded-model-delete"
        />
      )}
    </ModelRow>
  );
};

export default DownloadedModelRow;

const styles = StyleSheet.create({
  row: {
    padding: ROW_PADDING,
  },
});
