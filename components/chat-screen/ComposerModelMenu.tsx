import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OverKeyboardView } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useModelStore } from '../../store/modelStore';
import { Model } from '../../database/modelRepository';
import { getModelFamily } from '../../utils/modelFamily';
import {
  familyIcon,
  familyInitial,
  UNKNOWN_FAMILY_COLOR,
} from '../../constants/model-families';
import { radius, space, stroke } from '../../constants/design-system';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { GUTTER } from './attachments/constants';
import CheckIcon from '../../assets/icons/check.svg';
import ModelsIcon from '../../assets/icons/models.svg';
import ChevronDownIcon from '../../assets/icons/chevron-down.svg';

const MENU_WIDTH = 300;
const ROW_MIN_HEIGHT = 44;
const TILE_SIZE = 28;
const TILE_ICON_SIZE = 16;
const CHECK_SIZE = 16;
const ALL_MODELS_ICON_SIZE = 16;
const ROW_CHEVRON_WIDTH = 10;
const ROW_CHEVRON_HEIGHT = 6;
const VISIBLE_ROWS = 5;
const ROW_HEIGHT = 52;
const NAME_SIZE = 15;
const FADE_IN_MS = 150;
const SHADOW_OPACITY = 0.18;
const SHADOW_RADIUS = 20;
const SHADOW_OFFSET_Y = 12;

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
    <OverKeyboardView visible={visible}>
      {visible ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View
            entering={FadeIn.duration(FADE_IN_MS)}
            style={StyleSheet.absoluteFill}
          >
            <Pressable
              style={[StyleSheet.absoluteFill, styles.scrim]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close model menu"
              testID="model-menu-backdrop"
            />
          </Animated.View>
          <Animated.View
            entering={FadeIn.duration(FADE_IN_MS)}
            style={[styles.shadow, { bottom: anchorBottom }]}
          >
            <View
              style={styles.menu}
              accessibilityRole="menu"
              accessibilityLabel="Choose model"
              testID="model-menu"
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
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
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
              </Pressable>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </OverKeyboardView>
  );
};

interface RowProps {
  model: Model;
  current: boolean;
  onPress: () => void;
}

const ModelRow = ({ model, current, onPress }: RowProps) => {
  const { styles } = useThemedStyles(createStyles);
  const family = getModelFamily(model);
  const FamilyIcon = familyIcon(family);
  const note = modelNote(model);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="menuitem"
      accessibilityState={{ checked: current }}
      accessibilityLabel={
        note ? `${model.modelName}, ${note}` : model.modelName
      }
      testID={`model-menu-row-${model.id}`}
    >
      <View
        style={[styles.tile, !FamilyIcon && styles.initialTile]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {FamilyIcon ? (
          <FamilyIcon
            width={TILE_ICON_SIZE}
            height={TILE_ICON_SIZE}
            style={styles.tileIcon}
          />
        ) : (
          <Text style={styles.tileInitial}>{familyInitial(family)}</Text>
        )}
      </View>
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
    </Pressable>
  );
};

export default ComposerModelMenu;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrim: {
      backgroundColor: theme.bg.popoverScrim,
    },
    shadow: {
      position: 'absolute',
      left: GUTTER,
      width: MENU_WIDTH,
      borderRadius: radius.eighteen,
      shadowColor: theme.bg.shadow,
      shadowOffset: { width: 0, height: SHADOW_OFFSET_Y },
      shadowOpacity: SHADOW_OPACITY,
      shadowRadius: SHADOW_RADIUS,
      elevation: 8,
    },
    menu: {
      borderRadius: radius.eighteen,
      borderWidth: stroke.soft,
      borderColor: theme.border.popover,
      backgroundColor: theme.bg.popover,
      paddingVertical: space.two,
      overflow: 'hidden',
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
    row: {
      minHeight: ROW_MIN_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
      paddingVertical: space.one + space.half,
      paddingHorizontal: space.four,
    },
    pressed: {
      backgroundColor: theme.bg.dialogAction,
    },
    tile: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      borderRadius: radius.six + space.half,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.tile,
    },
    tileIcon: {
      color: theme.text.primary,
    },
    initialTile: {
      backgroundColor: theme.label[UNKNOWN_FAMILY_COLOR].background,
    },
    tileInitial: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.label[UNKNOWN_FAMILY_COLOR].foreground,
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
      width: TILE_SIZE,
      height: TILE_SIZE,
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
