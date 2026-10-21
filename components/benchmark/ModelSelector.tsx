import React, { Dispatch, SetStateAction, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Model } from '../../database/modelRepository';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import ModelSelectSheet from '../bottomSheets/ModelSelectSheet';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import { radius, space, stroke } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { getModelFamily } from '../../utils/modelFamily';
import ModelFamilyTile from '../model-hub/ModelFamilyTile';

interface Props {
  model?: Model | null;
  setSelectedModel: Dispatch<SetStateAction<Model | undefined>>;
}

const modelMeta = (model: Model) =>
  [
    model.modelSize ? `${model.modelSize.toFixed(2)} GB` : null,
    model.parameters ? `${model.parameters.toFixed(2)} B params` : null,
  ]
    .filter(Boolean)
    .join(' · ');

export const ModelSelector = ({ model, setSelectedModel }: Props) => {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { styles } = useThemedStyles(createStyles);
  const meta = model ? modelMeta(model) : '';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          model ? `Change model, current ${model.modelName}` : 'Select a model'
        }
        style={({ pressed }) => [styles.selector, pressed && pressedOpacity]}
        onPress={() => bottomSheetModalRef.current?.present()}
        testID="benchmark-model-selector"
      >
        {model && (
          <ModelFamilyTile family={getModelFamily(model)} size="list" />
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {model ? model.modelName : 'Select a model'}
          </Text>
          {meta.length > 0 && <Text style={styles.meta}>{meta}</Text>}
        </View>
        <Text
          style={styles.action}
          maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
        >
          {model ? 'Change' : 'Choose'}
        </Text>
      </Pressable>

      <ModelSelectSheet
        bottomSheetModalRef={bottomSheetModalRef}
        onModelPicked={setSelectedModel}
      />
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
      padding: space.three,
      borderRadius: radius.eighteen,
      borderWidth: stroke.soft,
      borderColor: theme.border.soft,
    },
    info: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
    meta: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultSecondary,
    },
    action: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.accent,
    },
  });
