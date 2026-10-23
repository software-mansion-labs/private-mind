import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useModelStore } from '../../store/modelStore';
import { Model } from '../../database/modelRepository';
import { space } from '../../constants/design-system';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { GUTTER } from './attachments/constants';
import Popover from '../menu/Popover';
import PopoverRow from '../menu/PopoverRow';
import { getModelFamily } from '../../utils/modelFamily';
import ModelFamilyTile from '../model-hub/ModelFamilyTile';
import CheckIcon from '../../assets/icons/check.svg';
import ModelsIcon from '../../assets/icons/models.svg';
import ChevronDownIcon from '../../assets/icons/chevron-down.svg';

const ICON_WELL = 28;
const CHECK_SIZE = 16;
const ALL_MODELS_ICON_SIZE = 16;
const ROW_CHEVRON_WIDTH = 10;
const ROW_CHEVRON_HEIGHT = 6;
const VISIBLE_ROWS = 5;
const ROW_HEIGHT = 52;
const NAME_SIZE = 15;

const modelNote = (model: Model) =>
  [
    model.thinking ? 'Thinking' : model.vision ? 'Vision' : null,
    model.modelSize ? `${model.modelSize.toFixed(2)} GB` : null,
  ]
    .filter(Boolean)
    .join(' · ');

interface Props {
  visible: boolean;
  anchorBottom: number;
  currentModelId?: number;
  onPick: (model: Model) => void;
  onShowAllModels: () => void;
  onClose: () => void;
}

const ComposerModelMenu = ({
  visible,
  anchorBottom,
  currentModelId,
  onPick,
  onShowAllModels,
  onClose,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const downloadedModels = useModelStore((state) => state.downloadedModels);

  return (
    <Popover
      visible={visible}
      anchor={{ bottom: anchorBottom, left: GUTTER }}
      onClose={onClose}
      closeLabel="Close model menu"
      backdropTestID="model-menu-backdrop"
      accessibilityRole="menu"
      accessibilityLabel="Choose model"
      testID="model-menu"
      contentStyle={styles.menu}
    >
      <Text style={styles.heading}>Model</Text>
      <ScrollView
        style={styles.list}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {downloadedModels.map((model) => (
          <ModelRow
            key={model.id}
            model={model}
            current={model.id === currentModelId}
            onPress={() => onPick(model)}
          />
        ))}
      </ScrollView>
      <PopoverRow
        onPress={onShowAllModels}
        accessibilityRole="menuitem"
        testID="model-menu-all-models"
      >
        <View style={styles.allModelsIcon}>
          <ModelsIcon
            width={ALL_MODELS_ICON_SIZE}
            height={ALL_MODELS_ICON_SIZE}
            style={styles.secondaryIcon}
          />
        </View>
        <Text style={[styles.name, styles.grow]}>All models</Text>
        <ChevronDownIcon
          width={ROW_CHEVRON_WIDTH}
          height={ROW_CHEVRON_HEIGHT}
          style={styles.rowChevron}
        />
      </PopoverRow>
    </Popover>
  );
};

interface RowProps {
  model: Model;
  current: boolean;
  onPress: () => void;
}

const ModelRow = ({ model, current, onPress }: RowProps) => {
  const { styles } = useThemedStyles(createStyles);
  const note = modelNote(model);

  return (
    <PopoverRow
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityState={{ checked: current }}
      accessibilityLabel={
        note ? `${model.modelName}, ${note}` : model.modelName
      }
      testID={`model-menu-row-${model.id}`}
    >
      <ModelFamilyTile family={getModelFamily(model)} size="row" />
      <View style={styles.grow}>
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
          testID="model-menu-current"
        />
      )}
    </PopoverRow>
  );
};

export default ComposerModelMenu;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    menu: {
      paddingVertical: space.two,
    },
    heading: {
      paddingTop: space.one,
      paddingBottom: space.one + space.half,
      paddingHorizontal: space.four,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
    list: {
      maxHeight: ROW_HEIGHT * VISIBLE_ROWS,
    },
    grow: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontFamily: fontFamily.medium,
      fontSize: NAME_SIZE,
      lineHeight: lineHeights.sm,
      color: theme.text.primary,
    },
    note: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
    check: {
      color: theme.text.accent,
    },
    allModelsIcon: {
      width: ICON_WELL,
      height: ICON_WELL,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryIcon: {
      color: theme.text.defaultSecondary,
    },
    rowChevron: {
      color: theme.text.defaultTertiary,
      transform: [{ rotate: '-90deg' }],
    },
  });
