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

const CHECK_SIZE = 20;

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
}

const ModelPickerRow = ({
  model,
  current,
  onPress,
  accessibilityRole,
  testIDPrefix,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);
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
      <ModelFamilyTile family={getModelFamily(model)} size="list" />
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
          width={CHECK_SIZE}
          height={CHECK_SIZE}
          style={styles.check}
          testID={`${testIDPrefix}-current`}
        />
      )}
    </PopoverRow>
  );
};

export default ModelPickerRow;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    text: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
    note: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultTertiary,
    },
    check: {
      color: theme.text.accent,
    },
  });
