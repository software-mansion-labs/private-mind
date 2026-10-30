import React, { useRef } from 'react';
import { Text, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Model } from '../../database/modelRepository';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import ModelSelectSheet from '../bottomSheets/ModelSelectSheet';
import { Theme } from '../../styles/colors';
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { getModelFamily } from '../../utils/modelFamily';
import { formatModelMeta } from '../../utils/modelMeta';
import ModelFamilyTile from '../model-hub/ModelFamilyTile';
import ModelRow from '../model-hub/ModelRow';
import ModelRowText from '../model-hub/ModelRowText';

interface Props {
  model?: Model | null;
  onSelect: (model: Model) => void;
}

export const ModelSelector = ({ model, onSelect }: Props) => {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { styles } = useThemedStyles(createStyles);
  const meta = model ? formatModelMeta(model, 'B params') : '';

  return (
    <>
      <ModelRow
        accessibilityRole="button"
        accessibilityLabel={
          model ? `Change model, current ${model.modelName}` : 'Select a model'
        }
        style={styles.selector}
        onPress={() => bottomSheetModalRef.current?.present()}
        testID="benchmark-model-selector"
      >
        {model && (
          <ModelFamilyTile family={getModelFamily(model)} size="list" />
        )}
        <ModelRowText
          title={model ? model.modelName : 'Select a model'}
          subtitle={meta}
        />
        <Text
          style={styles.action}
          maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
        >
          {model ? 'Change' : 'Choose'}
        </Text>
      </ModelRow>

      <ModelSelectSheet
        bottomSheetModalRef={bottomSheetModalRef}
        onModelPicked={onSelect}
        currentModelId={model?.id}
      />
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    selector: {
      padding: space.three,
      borderRadius: radius.eighteen,
      borderWidth: stroke.soft,
      borderColor: theme.border.soft,
    },
    action: {
      ...textStyles.bodySecondaryMedium,
      color: theme.text.accent,
    },
  });
