import React from 'react';
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useDeleteModelFiles } from '../../hooks/useDeleteModelFiles';
import { Theme } from '../../styles/colors';
import { DIMMED_OPACITY, pressedOpacity } from '../../styles/pressable';
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../constants/design-system';
import { Model } from '../../database/modelRepository';
import { useModelStore } from '../../store/modelStore';
import { isModelCompatible } from '../../utils/modelCompatibility';
import { getModelFamily } from '../../utils/modelFamily';
import { formatModelMeta } from '../../utils/modelMeta';
import ModelFamilyTile from '../model-hub/ModelFamilyTile';
import ModelRow from '../model-hub/ModelRow';
import ModelRowText from '../model-hub/ModelRowText';
import ModelCapabilityBadges from '../model-hub/ModelCapabilityBadges';
import CloseIcon from '../../assets/icons/close.svg';
import TrashIcon from '../../assets/icons/trash.svg';
import CheckIcon from '../../assets/icons/check.svg';

const PROGRESS_LABEL_MIN_WIDTH = 48;
const CHECKBOX_SIZE = 24;
const CHECKBOX_RADIUS = 7;
const CHECKBOX_BORDER_WIDTH = 1.5;
const CHECKBOX_ICON_SIZE = 14;
const PROGRESS_ACTION_ICON_SIZE = 16;
const PROGRESS_ACTION_HIT_SLOP = 12;
const LOCKED_CARD_OPACITY = 0.4;

export type StartingDownloadStatus = 'downloading' | 'done';

interface Props {
  model: Model;
  selected: boolean;
  locked: boolean;
  downloadStatus?: StartingDownloadStatus;
  onPress: (model: Model) => void;
  onCancel: (model: Model) => void;
  onDeleted: (model: Model) => void;
}

const StartingModelCard = ({
  model,
  selected,
  locked,
  downloadStatus,
  onPress,
  onCancel,
  onDeleted,
}: Props) => {
  const { styles } = useThemedStyles(createStyles, selected);
  const trackedProgress = useModelStore(
    (state) => state.downloadStates[model.id]?.progress ?? 0
  );
  const { deleteModelFiles, ConfirmElement } = useDeleteModelFiles();

  const isCompatible = isModelCompatible(model);
  const isDone = downloadStatus === 'done';
  const isDownloading = downloadStatus === 'downloading';
  const canDelete = isDone && model.source !== 'local';
  const progress = isDone ? 1 : trackedProgress;
  const progressLabel = isDone ? 'Done' : `${Math.floor(progress * 100)}%`;

  const handleDelete = async () => {
    if (await deleteModelFiles(model)) onDeleted(model);
  };

  const accessibilityActions: AccessibilityActionInfo[] = [
    ...(isDownloading
      ? [{ name: 'cancelDownload', label: 'Cancel download' }]
      : []),
    ...(canDelete ? [{ name: 'delete', label: 'Delete model files' }] : []),
  ];

  const handleAccessibilityAction = ({
    nativeEvent,
  }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === 'cancelDownload') onCancel(model);
    if (nativeEvent.actionName === 'delete') handleDelete();
  };

  return (
    <View style={locked && !selected && styles.lockedCard}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          !isCompatible && styles.incompatibleCard,
          pressed && pressedOpacity,
        ]}
        onPress={locked ? undefined : () => onPress(model)}
        disabled={!isCompatible || locked}
        accessibilityRole="checkbox"
        accessibilityState={{
          checked: selected,
          disabled: !isCompatible || locked,
        }}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}
      >
        <ModelRow>
          <ModelFamilyTile family={getModelFamily(model)} size="card" />
          <ModelRowText
            title={model.modelName}
            titleLines={0}
            titleStyle={!isCompatible && styles.incompatibleTitle}
            subtitle={formatModelMeta(model, 'B')}
            style={styles.text}
          >
            <ModelCapabilityBadges model={model} style={styles.badges} />
          </ModelRowText>
          <View style={styles.checkbox} testID="starting-model-checkbox">
            {selected && (
              <CheckIcon
                width={CHECKBOX_ICON_SIZE}
                height={CHECKBOX_ICON_SIZE}
                style={styles.checkIcon}
              />
            )}
          </View>
        </ModelRow>

        {downloadStatus && (
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{progressLabel}</Text>
            {canDelete && (
              <Pressable
                onPress={handleDelete}
                hitSlop={PROGRESS_ACTION_HIT_SLOP}
                style={({ pressed }) => pressed && pressedOpacity}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${model.modelName}`}
                testID="starting-model-delete"
              >
                <TrashIcon
                  width={PROGRESS_ACTION_ICON_SIZE}
                  height={PROGRESS_ACTION_ICON_SIZE}
                  style={styles.progressActionIcon}
                />
              </Pressable>
            )}
            {isDownloading && (
              <Pressable
                onPress={() => onCancel(model)}
                hitSlop={PROGRESS_ACTION_HIT_SLOP}
                style={({ pressed }) => pressed && pressedOpacity}
                accessibilityRole="button"
                accessibilityLabel={`Cancel ${model.modelName} download`}
                testID="starting-model-cancel"
              >
                <CloseIcon
                  width={PROGRESS_ACTION_ICON_SIZE}
                  height={PROGRESS_ACTION_ICON_SIZE}
                  style={styles.progressActionIcon}
                />
              </Pressable>
            )}
          </View>
        )}

        {ConfirmElement}
      </Pressable>
    </View>
  );
};

export default StartingModelCard;

const createStyles = (theme: Theme, selected: boolean) => {
  const borderWidth = selected ? stroke.strong : stroke.soft;
  return StyleSheet.create({
    card: {
      padding: space.four - (borderWidth - stroke.soft),
      borderWidth,
      borderRadius: radius.twelve,
      borderColor: selected ? theme.bg.strongPrimary : theme.border.soft,
      backgroundColor: selected ? theme.bg.cardSelected : undefined,
      gap: space.three,
    },
    text: {
      gap: space.one,
    },
    badges: {
      marginTop: space.one,
    },
    checkbox: {
      width: CHECKBOX_SIZE,
      height: CHECKBOX_SIZE,
      borderRadius: CHECKBOX_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: selected ? 0 : CHECKBOX_BORDER_WIDTH,
      borderColor: theme.border.soft,
      backgroundColor: selected ? theme.bg.strongPrimary : undefined,
    },
    checkIcon: {
      color: theme.text.contrastPrimary,
    },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
    },
    progressTrack: {
      flex: 1,
      height: space.two,
      borderRadius: radius.full,
      overflow: 'hidden',
      backgroundColor: theme.bg.tile,
    },
    progressFill: {
      height: '100%',
      borderRadius: radius.full,
      backgroundColor: theme.bg.strongPrimary,
    },
    progressText: {
      minWidth: PROGRESS_LABEL_MIN_WIDTH,
      textAlign: 'right',
      ...textStyles.bodyTertiaryRegular,
      color: theme.text.defaultSecondary,
    },
    progressActionIcon: {
      color: theme.text.defaultSecondary,
    },
    lockedCard: {
      opacity: LOCKED_CARD_OPACITY,
    },
    incompatibleCard: {
      opacity: DIMMED_OPACITY,
      borderColor: theme.border.soft,
    },
    incompatibleTitle: {
      color: theme.text.defaultTertiary,
    },
  });
};
