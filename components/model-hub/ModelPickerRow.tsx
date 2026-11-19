import React from 'react';
import {
  AccessibilityRole,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Model } from '../../database/modelRepository';
import { ModelState, useModelStore } from '../../store/modelStore';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { dimmedOpacity, pressedOpacity } from '../../styles/pressable';
import { radius, space } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import PopoverRow from '../menu/PopoverRow';
import { getModelFamily } from '../../utils/modelFamily';
import { formatGB, joinMeta } from '../../utils/modelMeta';
import { THINKING_LABEL, VISION_LABEL } from '../../constants/model-labels';
import { MODEL_UPDATE_TEXT } from '../../constants/model-update';
import { requiresUpdate } from '../../utils/modelUpdate';
import ModelFamilyTile from './ModelFamilyTile';
import CheckIcon from '../../assets/icons/check.svg';

const CHECK_SIZE = 20;
const UPDATE_BUTTON_HEIGHT = 32;
const UPDATE_HIT_SLOP = 8;

const modelNote = (model: Model) =>
  joinMeta([
    model.thinking ? THINKING_LABEL : model.vision ? VISION_LABEL : null,
    model.modelSize ? formatGB(model.modelSize) : null,
  ]);

interface Props {
  model: Model;
  current: boolean;
  onPress: () => void;
  onUpdate?: () => void;
  accessibilityRole: AccessibilityRole;
  testIDPrefix: string;
}

const ModelPickerRow = ({
  model,
  current,
  onPress,
  onUpdate,
  accessibilityRole,
  testIDPrefix,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const download = useModelStore((state) => state.downloadStates[model.id]);
  const blocked = requiresUpdate(model);
  const note = modelNote(model);
  const updating = download?.status === ModelState.Downloading;

  return (
    <PopoverRow
      onPress={onPress}
      disabled={blocked}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ checked: current, disabled: blocked }}
      accessibilityLabel={
        note ? `${model.modelName}, ${note}` : model.modelName
      }
      testID={`${testIDPrefix}-row-${model.id}`}
    >
      <View style={blocked && dimmedOpacity}>
        <ModelFamilyTile family={getModelFamily(model)} size="list" />
      </View>
      <View style={[styles.text, blocked && dimmedOpacity]}>
        <Text style={styles.name} numberOfLines={1}>
          {model.modelName}
        </Text>
        {note ? (
          <Text style={styles.note} numberOfLines={1}>
            {note}
          </Text>
        ) : null}
      </View>
      {blocked && onUpdate && (
        <Pressable
          onPress={onUpdate}
          disabled={updating}
          hitSlop={UPDATE_HIT_SLOP}
          style={({ pressed }) => [
            styles.updateButton,
            pressed && pressedOpacity,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Update ${model.modelName}`}
          accessibilityState={{ busy: updating }}
          testID={`${testIDPrefix}-update-${model.id}`}
        >
          <Text
            style={styles.updateButtonText}
            maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
          >
            {updating
              ? `${Math.round(download.progress * 100)}%`
              : MODEL_UPDATE_TEXT.chatBannerAction}
          </Text>
        </Pressable>
      )}
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
    updateButton: {
      minHeight: UPDATE_BUTTON_HEIGHT,
      justifyContent: 'center',
      paddingHorizontal: space.three,
      borderRadius: radius.full,
      backgroundColor: theme.bg.accentSoft,
    },
    updateButtonText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.accent,
    },
  });
