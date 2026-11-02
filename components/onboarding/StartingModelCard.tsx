import React from 'react';
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  StyleSheet,
  View,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useDeleteModelFiles } from '../../hooks/useDeleteModelFiles';
import { Theme } from '../../styles/colors';
import { DIMMED_OPACITY, pressedOpacity } from '../../styles/pressable';
import { radius, space, stroke } from '../../constants/design-system';
import { Model } from '../../database/modelRepository';
import { useModelStore } from '../../store/modelStore';
import { isModelCompatible } from '../../utils/modelCompatibility';
import { getModelFamily } from '../../utils/modelFamily';
import { formatModelMeta } from '../../utils/modelMeta';
import CircleButton, { CIRCLE_BUTTON_SIZE } from '../CircleButton';
import ModelFamilyTile from '../model-hub/ModelFamilyTile';
import ModelRow from '../model-hub/ModelRow';
import ModelRowText from '../model-hub/ModelRowText';
import ModelCapabilityBadges from '../model-hub/ModelCapabilityBadges';
import DownloadedBadge from '../model-hub/DownloadedBadge';
import DownloadPercent from '../model-hub/DownloadPercent';
import DownloadProgressBar from '../model-hub/DownloadProgressBar';
import DownloadProgressDetails from '../model-hub/DownloadProgressDetails';
import CloseIcon from '../../assets/icons/close.svg';
import TrashIcon from '../../assets/icons/trash.svg';
import CheckIcon from '../../assets/icons/check.svg';

const CHECKBOX_SIZE = 24;
const CHECKBOX_RADIUS = 7;
const CHECKBOX_BORDER_WIDTH = 1.5;
const CHECKBOX_ICON_SIZE = 14;
const ACTION_ICON_SIZE = 16;
const CANCEL_ICON_SIZE = 13.33;
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
  const { styles, theme } = useThemedStyles(createStyles, selected);
  const trackedProgress = useModelStore(
    (state) => state.downloadStates[model.id]?.progress ?? 0
  );
  const rate = useModelStore((state) => state.downloadStates[model.id]?.rate);
  const { deleteModelFiles, ConfirmElement } = useDeleteModelFiles();

  const isCompatible = isModelCompatible(model);
  const isDone = downloadStatus === 'done';
  const isDownloading = downloadStatus === 'downloading';
  const canDelete = isDone && model.source !== 'local';

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

  const titleAccessory = isDownloading ? (
    <DownloadPercent progress={trackedProgress} />
  ) : isDone ? (
    <DownloadedBadge testID="starting-model-downloaded" />
  ) : undefined;

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
        <ModelRow align="top" style={styles.row}>
          <ModelFamilyTile family={getModelFamily(model)} size="list" />
          <ModelRowText
            title={model.modelName}
            titleLines={0}
            titleStyle={!isCompatible && styles.incompatibleTitle}
            titleAccessory={titleAccessory}
            accessoryPlacement={isDownloading ? 'end' : 'inline'}
            subtitle={formatModelMeta(model, 'B')}
            style={styles.text}
          >
            <ModelCapabilityBadges model={model} style={styles.badges} />
            {isDownloading && (
              <View style={styles.progress}>
                <DownloadProgressBar
                  progress={trackedProgress}
                  accessibilityLabel={`${model.modelName} download progress`}
                />
                <DownloadProgressDetails
                  modelSize={model.modelSize}
                  progress={trackedProgress}
                  rate={rate}
                />
              </View>
            )}
          </ModelRowText>
          <View style={styles.trailing}>
            {isDownloading ? (
              <CircleButton
                onPress={() => onCancel(model)}
                backgroundColor={theme.bg.tile}
                color={theme.text.primary}
                icon={CloseIcon}
                size={CANCEL_ICON_SIZE}
                testID="starting-model-cancel"
              />
            ) : canDelete ? (
              <CircleButton
                onPress={handleDelete}
                backgroundColor={theme.bg.errorSecondary}
                color={theme.text.error}
                icon={TrashIcon}
                size={ACTION_ICON_SIZE}
                testID="starting-model-delete"
              />
            ) : (
              <View style={styles.checkbox} testID="starting-model-checkbox">
                {selected && (
                  <CheckIcon
                    width={CHECKBOX_ICON_SIZE}
                    height={CHECKBOX_ICON_SIZE}
                    style={styles.checkIcon}
                  />
                )}
              </View>
            )}
          </View>
        </ModelRow>

        {ConfirmElement}
      </Pressable>
    </View>
  );
};

export default StartingModelCard;

const createStyles = (theme: Theme, selected: boolean) => {
  const borderWidth = selected ? stroke.strong : stroke.soft;
  const borderGrowth = borderWidth - stroke.soft;
  return StyleSheet.create({
    card: {
      borderWidth,
      borderRadius: radius.eighteen,
      borderColor: selected ? theme.bg.strongPrimary : theme.border.soft,
      backgroundColor: theme.bg.softPrimary,
    },
    row: {
      gap: space.three,
      padding: space.four - borderGrowth,
    },
    trailing: {
      width: CIRCLE_BUTTON_SIZE,
      alignItems: 'center',
    },
    text: {
      gap: space.one,
    },
    badges: {
      marginTop: space.one,
    },
    progress: {
      marginTop: space.two,
      gap: space.two,
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
