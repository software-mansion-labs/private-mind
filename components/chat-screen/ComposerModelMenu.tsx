import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useModelStore } from '../../store/modelStore';
import { Model } from '../../database/modelRepository';
import { space, textStyles } from '../../constants/design-system';
import { fontFamily, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { GUTTER } from './attachments/constants';
import Popover from '../menu/Popover';
import PopoverRow from '../menu/PopoverRow';
import ModelPickerRow from '../model-hub/ModelPickerRow';
import ModelsIcon from '../../assets/icons/models.svg';
import ChevronDownIcon from '../../assets/icons/chevron-down.svg';

const ICON_WELL = 28;
const ALL_MODELS_ICON_SIZE = 16;
const ROW_CHEVRON_WIDTH = 10;
const ROW_CHEVRON_HEIGHT = 6;
const VISIBLE_ROWS = 5;
const ROW_HEIGHT = 52;
const NAME_SIZE = 15;

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
          <ModelPickerRow
            key={model.id}
            model={model}
            current={model.id === currentModelId}
            onPress={() => onPick(model)}
            accessibilityRole="menuitem"
            testIDPrefix="model-menu"
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
      ...textStyles.bodyTertiaryRegular,
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
