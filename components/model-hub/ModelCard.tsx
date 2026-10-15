import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
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
import { getModelFamily } from '../../utils/modelFamily';
import {
  UNKNOWN_FAMILY_COLOR,
  familyIcon,
  familyInitial,
} from '../../constants/model-families';
import { useConfirm } from '../../hooks/useConfirm';
import CircleButton from '../CircleButton';
import ModelBadge from './ModelBadge';
import {
  THINKING_LABEL,
  VISION_LABEL,
  isCapabilityLabel,
} from '../../constants/model-labels';
import DownloadIcon from '../../assets/icons/download.svg';
import CloseIcon from '../../assets/icons/close.svg';
import TrashIcon from '../../assets/icons/trash.svg';
import CheckIcon from '../../assets/icons/check.svg';
import { Feedback } from '../../utils/Feedback';
import { radius, space, stroke } from '../../constants/design-system';

const FAMILY_TILE_SIZE = 44;
const FAMILY_ICON_SIZE = 24;
const PROGRESS_LABEL_MIN_WIDTH = 48;
const CHECKBOX_SIZE = 24;
const CHECKBOX_RADIUS = 7;
const CHECKBOX_BORDER_WIDTH = 1.5;
const CHECKBOX_ICON_SIZE = 14;
const PROGRESS_ACTION_ICON_SIZE = 16;
const PROGRESS_ACTION_HIT_SLOP = 12;
const PRESSED_OPACITY = 0.6;
const LOCKED_CARD_OPACITY = 0.4;

export type DownloadStatus = 'downloading' | 'done';

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
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles, selected);

  const trackedDownload = useModelStore(
    (state) => state.downloadStates[model.id]
  );
  const downloadModel = useModelStore((state) => state.downloadModel);
  const cancelDownload = useModelStore((state) => state.cancelDownload);
  const removeModelFiles = useModelStore((state) => state.removeModelFiles);
  const { confirm, ConfirmElement } = useConfirm();

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
    const confirmed = await confirm({
      title: 'Delete model files?',
      message: `${model.modelName} will be removed from your device. You can redownload it later.`,
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;

    await removeModelFiles(model.id);
    Toast.show({
      type: 'defaultToast',
      text1: `${model.modelName} has been successfully deleted`,
    });
    onDeleted?.(model);
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
  const family = getModelFamily(model);
  const FamilyIcon = familyIcon(family);
  const labels = compactView
    ? []
    : (model.labels ?? []).filter((label) => !isCapabilityLabel(label));
  const hasBadges =
    !isCompatible || model.thinking || model.vision || labels.length > 0;

  return (
    <View style={locked && !selected && styles.dimmedCard}>
      <TouchableOpacity
        style={[styles.card, !isCompatible && styles.incompatibleCard]}
        onPress={locked ? undefined : () => onPress(model)}
        disabled={disabled}
        activeOpacity={locked ? 1 : undefined}
        accessibilityRole={checkable ? 'checkbox' : undefined}
        accessibilityState={
          checkable
            ? { checked: selected, disabled: disabled || locked }
            : undefined
        }
      >
        <View style={styles.topRow}>
          {showFamilyIcon && (
            <View
              style={[styles.familyTile, !FamilyIcon && styles.initialTile]}
              testID="model-family-tile"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {FamilyIcon ? (
                <FamilyIcon
                  width={FAMILY_ICON_SIZE}
                  height={FAMILY_ICON_SIZE}
                  style={styles.familyIcon}
                  testID="model-family-icon"
                />
              ) : (
                <Text style={styles.familyInitial}>
                  {familyInitial(family)}
                </Text>
              )}
            </View>
          )}

          <View style={styles.info}>
            <Text
              style={[styles.name, !isCompatible && styles.incompatibleText]}
            >
              {model.modelName}
            </Text>
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
              backgroundColor={theme.bg.errorSecondary}
              color={theme.text.primary}
              icon={CloseIcon}
              size={13.33}
            />
          )}

          {showDownloadControls && modelState === ModelState.NotStarted && (
            <CircleButton
              onPress={!isCompatible ? undefined : handlePress}
              backgroundColor={
                !isCompatible ? theme.border.soft : theme.bg.softSecondary
              }
              color={
                !isCompatible ? theme.text.defaultTertiary : theme.text.primary
              }
              icon={DownloadIcon}
              size={15}
              disabled={!isCompatible}
            />
          )}

          {showDownloadControls &&
            showDeleteButton &&
            modelState === ModelState.Downloaded &&
            model.source !== 'local' && (
              <CircleButton
                onPress={handleDelete}
                backgroundColor={theme.bg.errorPrimary}
                color={theme.text.contrastPrimary}
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
              <TouchableOpacity
                onPress={handleDelete}
                hitSlop={PROGRESS_ACTION_HIT_SLOP}
                activeOpacity={PRESSED_OPACITY}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${model.modelName}`}
                testID="model-card-delete"
              >
                <TrashIcon
                  width={PROGRESS_ACTION_ICON_SIZE}
                  height={PROGRESS_ACTION_ICON_SIZE}
                  style={styles.progressActionIcon}
                />
              </TouchableOpacity>
            )}
            {downloadStatus === 'downloading' && (
              <TouchableOpacity
                onPress={() => onCancel?.(model)}
                hitSlop={PROGRESS_ACTION_HIT_SLOP}
                activeOpacity={PRESSED_OPACITY}
                accessibilityRole="button"
                accessibilityLabel={`Cancel ${model.modelName} download`}
                testID="model-card-cancel"
              >
                <CloseIcon
                  width={PROGRESS_ACTION_ICON_SIZE}
                  height={PROGRESS_ACTION_ICON_SIZE}
                  style={styles.progressActionIcon}
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {(showDeleteButton || checkable) && ConfirmElement}
      </TouchableOpacity>
    </View>
  );
};

export default ModelCard;

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
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
    },
    familyTile: {
      width: FAMILY_TILE_SIZE,
      height: FAMILY_TILE_SIZE,
      borderRadius: radius.twelve,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.tile,
    },
    familyIcon: {
      color: theme.text.primary,
    },
    initialTile: {
      backgroundColor: theme.label[UNKNOWN_FAMILY_COLOR].background,
    },
    familyInitial: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.lg,
      lineHeight: lineHeights.lg,
      color: theme.label[UNKNOWN_FAMILY_COLOR].foreground,
    },
    info: {
      flex: 1,
      gap: space.one,
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
      backgroundColor: theme.bg.strongPrimary,
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
      opacity: 0.5,
      borderColor: theme.border.soft,
    },
    incompatibleText: {
      color: theme.text.defaultTertiary,
    },
  });
};
