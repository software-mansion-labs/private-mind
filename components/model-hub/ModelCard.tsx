import React from 'react';
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { Model } from '../../database/modelRepository';
import { ModelState, useModelStore } from '../../store/modelStore';
import { WarningSheetData } from '../bottomSheets/WarningSheet';
import { isModelCompatible } from '../../utils/modelCompatibility';
import { useDeleteModelFiles } from '../../hooks/useDeleteModelFiles';
import CircleButton from '../CircleButton';
import ModelBadge from './ModelBadge';
import { getModelFamily } from '../../utils/modelFamily';
import ModelFamilyTile from './ModelFamilyTile';
import DownloadedBadge from './DownloadedBadge';
import {
  THINKING_LABEL,
  VISION_LABEL,
  isCapabilityLabel,
} from '../../constants/model-labels';
import DownloadArrowIcon from '../../assets/icons/download-arrow.svg';
import CloseIcon from '../../assets/icons/close.svg';
import TrashIcon from '../../assets/icons/trash.svg';
import CheckIcon from '../../assets/icons/check.svg';
import { Feedback } from '../../utils/Feedback';
import { pressedOpacity } from '../../styles/pressable';
import { radius, space, stroke } from '../../constants/design-system';
import { DIMMED_OPACITY } from '../../styles/pressable';

const PROGRESS_LABEL_MIN_WIDTH = 48;
const CHECKBOX_SIZE = 24;
const CHECKBOX_RADIUS = 7;
const CHECKBOX_BORDER_WIDTH = 1.5;
const CHECKBOX_ICON_SIZE = 14;
const PROGRESS_ACTION_ICON_SIZE = 16;
const PROGRESS_ACTION_HIT_SLOP = 12;
const LOCKED_CARD_OPACITY = 0.4;
const DOWNLOAD_ICON_SIZE = 16;

export type DownloadStatus = 'downloading' | 'done';
export type ModelCardVariant = 'card' | 'row';

interface Props {
  model: Model;
  compactView?: boolean;
  selected?: boolean;
  onPress: (model: Model) => void;
  wifiWarningSheetRef?: React.RefObject<BottomSheetModal<WarningSheetData> | null>;
  showDeleteButton?: boolean;
  checkable?: boolean;
  showFamilyIcon?: boolean;
  downloadStatus?: DownloadStatus;
  locked?: boolean;
  onCancel?: (model: Model) => void;
  onDeleted?: (model: Model) => void;
  variant?: ModelCardVariant;
}

const modelMeta = (model: Model) =>
  [
    model.modelSize ? `${model.modelSize.toFixed(2)} GB` : null,
    model.parameters ? `${model.parameters.toFixed(2)} B` : null,
  ]
    .filter(Boolean)
    .join(' · ');

const ModelCard = ({
  model,
  compactView = true,
  selected = false,
  onPress,
  wifiWarningSheetRef,
  showDeleteButton = false,
  checkable = false,
  showFamilyIcon = false,
  downloadStatus,
  locked = false,
  onCancel,
  onDeleted,
  variant = 'card',
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles, selected, variant);
  const isRow = variant === 'row';

  const trackedDownload = useModelStore(
    (state) => state.downloadStates[model.id]
  );
  const downloadModel = useModelStore((state) => state.downloadModel);
  const cancelDownload = useModelStore((state) => state.cancelDownload);
  const { deleteModelFiles, ConfirmElement } = useDeleteModelFiles();

  const downloadState = trackedDownload ?? {
    progress: model.isDownloaded ? 1 : 0,
    status: model.isDownloaded ? ModelState.Downloaded : ModelState.NotStarted,
  };

  const modelState = downloadState.status;
  const isDownloading = modelState === ModelState.Downloading;

  const handlePress = async () => {
    if (isDownloading) {
      Feedback.cancelDownload();
      await cancelDownload(model);
      return;
    }

    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Model cannot be downloaded without internet connection.',
      });
      return;
    }

    if (
      networkState.isConnected &&
      networkState.type !== 'wifi' &&
      wifiWarningSheetRef?.current
    ) {
      wifiWarningSheetRef.current?.present({
        title: 'No WiFi Connection Detected.',
        subtitle:
          'Downloading models will use your mobile data, which may incur additional charges from your carrier. We recommend connecting to WiFi for the best experience.',
        buttonTitle: 'Download anyway',
        onConfirm: async () => {
          Feedback.downloadStart();
          await downloadModel(model);
        },
      });
      return;
    }

    Feedback.downloadStart();
    await downloadModel(model);
  };

  const handleDelete = async () => {
    if (await deleteModelFiles(model)) onDeleted?.(model);
  };

  const isDone = downloadStatus === 'done';
  const progress = isDone ? 1 : downloadState.progress;
  const progressLabel = isDone
    ? 'Done'
    : `${Math.floor(downloadState.progress * 100)}%`;
  const showProgressRow = checkable
    ? downloadStatus !== undefined
    : isDownloading;

  const isCompatible = isModelCompatible(model);
  const disabled = checkable
    ? !isCompatible
    : modelState !== ModelState.Downloaded && model.source === 'built-in';
  const showDownloadControls = !checkable;
  const meta = modelMeta(model);
  const labels = compactView
    ? []
    : (model.labels ?? []).filter((label) => !isCapabilityLabel(label));
  const showDownloadedBadge =
    showDownloadControls && isRow && modelState === ModelState.Downloaded;
  const hasBadges =
    !isCompatible || model.thinking || model.vision || labels.length > 0;

  const isPickedDownloadRunning = downloadStatus === 'downloading';
  const canDownload =
    showDownloadControls &&
    modelState === ModelState.NotStarted &&
    isCompatible;
  const canCancelDownload =
    (showDownloadControls && isDownloading) || isPickedDownloadRunning;
  const canDelete =
    model.source !== 'local' &&
    (isDone ||
      (showDownloadControls &&
        showDeleteButton &&
        modelState === ModelState.Downloaded));

  const accessibilityActions: AccessibilityActionInfo[] = [
    ...(canDownload ? [{ name: 'download', label: 'Download' }] : []),
    ...(canCancelDownload
      ? [{ name: 'cancelDownload', label: 'Cancel download' }]
      : []),
    ...(canDelete ? [{ name: 'delete', label: 'Delete model files' }] : []),
  ];

  const hasAccessibilityActions = accessibilityActions.length > 0;

  const handleCancelDownload = () => {
    if (isPickedDownloadRunning) {
      onCancel?.(model);
      return;
    }
    handlePress();
  };

  const handleAccessibilityAction = ({
    nativeEvent,
  }: AccessibilityActionEvent) => {
    switch (nativeEvent.actionName) {
      case 'download':
        handlePress();
        return;
      case 'cancelDownload':
        handleCancelDownload();
        return;
      case 'delete':
        handleDelete();
    }
  };

  return (
    <View style={locked && !selected && styles.dimmedCard}>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          !isCompatible && styles.incompatibleCard,
          pressed && pressedOpacity,
        ]}
        onPress={locked ? undefined : () => onPress(model)}
        disabled={disabled || locked}
        accessibilityRole={checkable ? 'checkbox' : 'button'}
        accessibilityState={
          checkable
            ? { checked: selected, disabled: disabled || locked }
            : { selected, disabled: disabled && !hasAccessibilityActions }
        }
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}
      >
        <View style={styles.topRow}>
          {showFamilyIcon && (
            <ModelFamilyTile
              family={getModelFamily(model)}
              size={isRow ? 'list' : 'card'}
            />
          )}

          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.name, !isCompatible && styles.incompatibleText]}
              >
                {model.modelName}
              </Text>
              {showDownloadedBadge && (
                <DownloadedBadge testID="model-card-downloaded" />
              )}
            </View>
            {meta.length > 0 && <Text style={styles.meta}>{meta}</Text>}
            {hasBadges && (
              <View style={styles.badges}>
                {!isCompatible && (
                  <ModelBadge label="Incompatible" color="error" />
                )}
                {model.thinking && <ModelBadge label={THINKING_LABEL} />}
                {model.vision && <ModelBadge label={VISION_LABEL} />}
                {labels.map((label) => (
                  <ModelBadge key={label} label={label} />
                ))}
              </View>
            )}
          </View>

          {checkable && (
            <View style={styles.checkbox} testID="model-card-checkbox">
              {selected && (
                <CheckIcon
                  width={CHECKBOX_ICON_SIZE}
                  height={CHECKBOX_ICON_SIZE}
                  style={styles.checkIcon}
                />
              )}
            </View>
          )}

          {showDownloadControls && modelState === ModelState.Downloading && (
            <CircleButton
              onPress={handlePress}
              backgroundColor={isRow ? theme.bg.tile : theme.bg.errorSecondary}
              color={theme.text.primary}
              icon={CloseIcon}
              size={13.33}
            />
          )}

          {showDownloadControls && modelState === ModelState.NotStarted && (
            <CircleButton
              onPress={!isCompatible ? undefined : handlePress}
              backgroundColor={
                isCompatible ? theme.bg.accentSoft : theme.border.soft
              }
              color={
                isCompatible ? theme.text.accent : theme.text.defaultTertiary
              }
              icon={DownloadArrowIcon}
              size={DOWNLOAD_ICON_SIZE}
              disabled={!isCompatible}
            />
          )}

          {showDownloadControls &&
            showDeleteButton &&
            modelState === ModelState.Downloaded &&
            model.source !== 'local' && (
              <CircleButton
                onPress={handleDelete}
                backgroundColor={
                  isRow ? theme.bg.errorSecondary : theme.bg.errorPrimary
                }
                color={isRow ? theme.text.error : theme.text.contrastPrimary}
                icon={TrashIcon}
                size={16}
              />
            )}
        </View>

        {showProgressRow && (
          <View style={styles.progressRow}>
            <View style={styles.progressBarContainer}>
              <View
                style={[styles.progressBar, { width: `${progress * 100}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{progressLabel}</Text>
            {isDone && model.source !== 'local' && (
              <Pressable
                onPress={handleDelete}
                hitSlop={PROGRESS_ACTION_HIT_SLOP}
                style={({ pressed }) => pressed && pressedOpacity}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${model.modelName}`}
                testID="model-card-delete"
              >
                <TrashIcon
                  width={PROGRESS_ACTION_ICON_SIZE}
                  height={PROGRESS_ACTION_ICON_SIZE}
                  style={styles.progressActionIcon}
                />
              </Pressable>
            )}
            {downloadStatus === 'downloading' && (
              <Pressable
                onPress={() => onCancel?.(model)}
                hitSlop={PROGRESS_ACTION_HIT_SLOP}
                style={({ pressed }) => pressed && pressedOpacity}
                accessibilityRole="button"
                accessibilityLabel={`Cancel ${model.modelName} download`}
                testID="model-card-cancel"
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

        {(showDeleteButton || checkable) && ConfirmElement}
      </Pressable>
    </View>
  );
};

export default ModelCard;

const createStyles = (
  theme: Theme,
  selected: boolean,
  variant: ModelCardVariant
) => {
  const borderWidth = selected ? stroke.strong : stroke.soft;
  const isRow = variant === 'row';
  return StyleSheet.create({
    card: isRow
      ? { padding: space.four, gap: space.three }
      : {
          padding: space.four - (borderWidth - stroke.soft),
          borderWidth,
          borderRadius: radius.twelve,
          borderColor: selected ? theme.bg.strongPrimary : theme.border.soft,
          backgroundColor: selected ? theme.bg.cardSelected : undefined,
          gap: space.three,
        },
    topRow: {
      flexDirection: 'row',
      alignItems: isRow ? 'flex-start' : 'center',
      gap: isRow ? space.two : space.three,
    },
    info: {
      flex: 1,
      gap: space.one,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.four,
    },
    name: {
      flexShrink: 1,
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
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.one,
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
    progressBarContainer: {
      flex: 1,
      height: space.two,
      borderRadius: radius.full,
      overflow: 'hidden',
      backgroundColor: theme.bg.tile,
    },
    progressBar: {
      height: '100%',
      borderRadius: radius.full,
      backgroundColor: isRow ? theme.bg.main : theme.bg.strongPrimary,
    },
    progressText: {
      minWidth: PROGRESS_LABEL_MIN_WIDTH,
      textAlign: 'right',
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
    progressActionIcon: {
      color: theme.text.defaultSecondary,
    },
    dimmedCard: {
      opacity: LOCKED_CARD_OPACITY,
    },
    incompatibleCard: {
      opacity: DIMMED_OPACITY,
      borderColor: theme.border.soft,
    },
    incompatibleText: {
      color: theme.text.defaultTertiary,
    },
  });
};
