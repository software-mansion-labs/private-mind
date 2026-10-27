import React from 'react';
import { AccessibilityRole, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Model } from '../../database/modelRepository';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import PopoverRow from '../menu/PopoverRow';
import { getModelFamily } from '../../utils/modelFamily';
import { formatGB, joinMeta } from '../../utils/modelMeta';
import { THINKING_LABEL, VISION_LABEL } from '../../constants/model-labels';
import ModelFamilyTile from './ModelFamilyTile';
import CheckIcon from '../../assets/icons/check.svg';

const ROW_SIZE = {
  compact: {
    tile: 'row',
    name: 15,
    nameLine: lineHeights.sm,
    note: fontSizes.xs,
    noteLine: lineHeights.xs,
    check: 16,
  },
  regular: {
    tile: 'list',
    name: fontSizes.md,
    nameLine: lineHeights.md,
    note: fontSizes.sm,
    noteLine: lineHeights.sm,
    check: 20,
  },
} as const;

export type ModelPickerRowSize = keyof typeof ROW_SIZE;

const modelNote = (model: Model) =>
  joinMeta([
    model.thinking ? THINKING_LABEL : model.vision ? VISION_LABEL : null,
    model.modelSize ? formatGB(model.modelSize) : null,
  ]);

interface Props {
  model: Model;
  current: boolean;
  onPress: () => void;
  accessibilityRole: AccessibilityRole;
  testIDPrefix: string;
  size?: ModelPickerRowSize;
}

const ModelPickerRow = ({
  model,
  current,
  onPress,
  accessibilityRole,
  testIDPrefix,
  size = 'compact',
}: Props) => {
  const { styles } = useThemedStyles(createStyles, size);
  const spec = ROW_SIZE[size];
  const note = modelNote(model);

  return (
    <PopoverRow
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ checked: current }}
      accessibilityLabel={
        note ? `${model.modelName}, ${note}` : model.modelName
      }
      testID={`${testIDPrefix}-row-${model.id}`}
    >
      <ModelFamilyTile family={getModelFamily(model)} size={spec.tile} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {model.modelName}
        </Text>
        {note ? (
          <Text style={styles.note} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
      </View>
      {current && (
        <CheckIcon
          width={spec.check}
          height={spec.check}
          style={styles.check}
          testID={`${testIDPrefix}-current`}
        />
      )}
    </PopoverRow>
  );
};

export default ModelPickerRow;

const createStyles = (theme: Theme, size: ModelPickerRowSize) => {
  const spec = ROW_SIZE[size];
  return StyleSheet.create({
    text: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontFamily: fontFamily.medium,
      fontSize: spec.name,
      lineHeight: spec.nameLine,
      color: theme.text.primary,
    },
    note: {
      fontFamily: fontFamily.regular,
      fontSize: spec.note,
      lineHeight: spec.noteLine,
      color: theme.text.defaultTertiary,
    },
    check: {
      color: theme.text.accent,
    },
  });
};
