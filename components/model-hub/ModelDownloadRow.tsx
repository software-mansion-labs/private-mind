import React from 'react';
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import {
  useModelDownload,
  type WifiWarningSheetRef,
} from '../../hooks/useModelDownload';
import { useDeleteModelFiles } from '../../hooks/useDeleteModelFiles';
import { useUpdateNetworkCheck } from '../../hooks/useUpdateNetworkCheck';
import { Theme } from '../../styles/colors';
import { dimmedOpacity, pressedOpacity } from '../../styles/pressable';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { MODEL_UPDATE_TEXT } from '../../constants/model-update';
import { radius, space, stroke } from '../../constants/design-system';
import { Model } from '../../database/modelRepository';
import { ModelState, useModelStore } from '../../store/modelStore';
import { isModelCompatible } from '../../utils/modelCompatibility';
import { getModelFamily } from '../../utils/modelFamily';
import { formatModelMeta } from '../../utils/modelMeta';
import { needsUpdate } from '../../utils/modelUpdate';
import { Feedback } from '../../utils/Feedback';
import CircleButton, { CIRCLE_BUTTON_SIZE } from '../CircleButton';
import ModelFamilyTile from './ModelFamilyTile';
import ModelRow from './ModelRow';
import ModelRowText from './ModelRowText';
import ModelCapabilityBadges from './ModelCapabilityBadges';
import DownloadedBadge from './DownloadedBadge';
import DownloadPercent from './DownloadPercent';
import DownloadProgressBar from './DownloadProgressBar';
import DownloadProgressDetails from './DownloadProgressDetails';
import { ROW_PADDING, TILE_ROW } from './RowGroup';
import DownloadArrowIcon from '../../assets/icons/download-arrow.svg';
import CloseIcon from '../../assets/icons/close.svg';
import TrashIcon from '../../assets/icons/trash.svg';
import CheckIcon from '../../assets/icons/check.svg';

const ACTION_ICON_SIZE = 16;
const CANCEL_ICON_SIZE = 13.33;
const CHECKBOX_SIZE = 24;
const CHECKBOX_RADIUS = 7;
const CHECKBOX_BORDER_WIDTH = 1.5;
const CHECKBOX_ICON_SIZE = 14;
const LOCKED_OPACITY = 0.4;
const UPDATE_HIT_SLOP = 8;

export interface ModelSelection {
  selected: boolean;
  locked: boolean;
}

interface Props {
  model: Model;
  onPress: (model: Model) => void;
  wifiWarningSheetRef?: WifiWarningSheetRef;
  showFamilyTile?: boolean;
  matchFamilyCards?: boolean;
  selection?: ModelSelection;
  onCancelled?: (model: Model) => void;
  onDeleted?: (model: Model) => void;
}

const ModelDownloadRow = ({
  model,
  onPress,
  wifiWarningSheetRef,
  showFamilyTile = false,
  matchFamilyCards = false,
  selection,
  onCancelled,
  onDeleted,
}: Props) => {
  const { styles, theme } = useThemedStyles(
    createStyles,
    selection?.selected ?? false
  );
  const { status, progress, rate, startDownload, stopDownload } =
    useModelDownload(model, wifiWarningSheetRef);
  const { deleteModelFiles, ConfirmElement } = useDeleteModelFiles();
  const updateOutdatedModel = useModelStore(
    (state) => state.updateOutdatedModel
  );
  const rememberUpdateConsent = useModelStore(
    (state) => state.rememberUpdateConsent
  );
  const { canDownload: canDownloadUpdate, ConfirmElement: UpdateConfirm } =
    useUpdateNetworkCheck();

  const isCompatible = isModelCompatible(model);
  const isDownloaded = status === ModelState.Downloaded;
  const isDownloading = status === ModelState.Downloading;
  const canDownload = status === ModelState.NotStarted && isCompatible;
  const canDelete = isDownloaded && model.source !== 'local';
  const canUpdate = isDownloaded && !selection && needsUpdate(model);
  const showsCheckbox = selection && !(selection.selected && selection.locked);
  const disabled = selection
    ? !isCompatible || selection.locked
    : !isDownloaded && model.source === 'built-in';

  const cancel = async () => {
    await stopDownload();
    onCancelled?.(model);
  };

  const remove = async () => {
    if (await deleteModelFiles(model)) onDeleted?.(model);
  };

  const update = async () => {
    const network = await canDownloadUpdate(model.modelSize ?? 0);
    if (!network) return;
    await rememberUpdateConsent([model.modelName], network === 'mobile-data');
    Feedback.downloadStart();
    await updateOutdatedModel(model);
  };

  const accessibilityActions: AccessibilityActionInfo[] = [
    ...(canDownload && !selection
      ? [{ name: 'download', label: 'Download' }]
      : []),
    ...(isDownloading
      ? [{ name: 'cancelDownload', label: 'Cancel download' }]
      : []),
    ...(canUpdate
      ? [{ name: 'update', label: MODEL_UPDATE_TEXT.chatBannerAction }]
      : []),
    ...(canDelete ? [{ name: 'delete', label: 'Delete model files' }] : []),
  ];

  const handleAccessibilityAction = ({
    nativeEvent,
  }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === 'download') startDownload();
    if (nativeEvent.actionName === 'cancelDownload') cancel();
    if (nativeEvent.actionName === 'update') update();
    if (nativeEvent.actionName === 'delete') remove();
  };

  const titleAccessory = isDownloading ? (
    <DownloadPercent progress={progress} />
  ) : isDownloaded ? (
    <DownloadedBadge testID="model-download-row-downloaded" />
  ) : undefined;

  const action = isDownloading ? (
    <CircleButton
      onPress={cancel}
      backgroundColor={theme.bg.tile}
      color={theme.text.primary}
      icon={CloseIcon}
      size={CANCEL_ICON_SIZE}
      testID="model-download-row-cancel"
    />
  ) : canDelete ? (
    <CircleButton
      onPress={remove}
      backgroundColor={theme.bg.errorSecondary}
      color={theme.text.error}
      icon={TrashIcon}
      size={ACTION_ICON_SIZE}
      testID="model-download-row-delete"
    />
  ) : status === ModelState.NotStarted ? (
    <CircleButton
      onPress={isCompatible ? startDownload : undefined}
      backgroundColor={isCompatible ? theme.bg.accentSoft : theme.border.soft}
      color={isCompatible ? theme.text.accent : theme.text.defaultTertiary}
      icon={DownloadArrowIcon}
      size={ACTION_ICON_SIZE}
      disabled={!isCompatible}
      testID="model-download-row-download"
    />
  ) : null;

  const updateButton = canUpdate && (
    <Pressable
      onPress={update}
      hitSlop={UPDATE_HIT_SLOP}
      style={({ pressed }) => [styles.updateButton, pressed && pressedOpacity]}
      accessibilityRole="button"
      accessibilityLabel={`Update ${model.modelName}`}
      testID="model-download-row-update"
    >
      <Text
        style={styles.updateButtonText}
        maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
      >
        {MODEL_UPDATE_TEXT.chatBannerAction}
      </Text>
    </Pressable>
  );

  const checkbox = selection && (
    <View style={styles.checkbox} testID="model-download-row-checkbox">
      {selection.selected && (
        <CheckIcon
          width={CHECKBOX_ICON_SIZE}
          height={CHECKBOX_ICON_SIZE}
          style={styles.checkIcon}
        />
      )}
    </View>
  );

  return (
    <View
      style={selection?.locked && !selection.selected && styles.lockedSelection}
    >
      <ModelRow
        align="top"
        style={[
          selection
            ? styles.card
            : [styles.row, matchFamilyCards && styles.tileRow],
          !isCompatible && dimmedOpacity,
        ]}
        onPress={() => onPress(model)}
        disabled={disabled}
        accessibilityRole={selection ? 'checkbox' : 'button'}
        accessibilityState={
          selection
            ? { checked: selection.selected, disabled }
            : { disabled: disabled && accessibilityActions.length === 0 }
        }
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}
        testID={`model-download-row-${model.id}`}
      >
        {showFamilyTile && (
          <View style={matchFamilyCards && styles.tile}>
            <ModelFamilyTile family={getModelFamily(model)} size="list" />
          </View>
        )}
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
                progress={progress}
                accessibilityLabel={`${model.modelName} download progress`}
              />
              <DownloadProgressDetails
                modelSize={model.modelSize}
                progress={progress}
                rate={rate}
              />
            </View>
          )}
        </ModelRowText>
        {selection ? (
          <View style={styles.trailing}>
            {showsCheckbox ? checkbox : action}
          </View>
        ) : updateButton ? (
          <View style={styles.actions}>
            {updateButton}
            {action}
          </View>
        ) : (
          action
        )}
        {ConfirmElement}
        {UpdateConfirm}
      </ModelRow>
    </View>
  );
};

export default ModelDownloadRow;

const createStyles = (theme: Theme, selected: boolean) => {
  const cardBorderWidth = selected ? stroke.strong : stroke.soft;
  const cardBorderGrowth = cardBorderWidth - stroke.soft;
  return StyleSheet.create({
    row: {
      padding: ROW_PADDING,
    },
    tileRow: {
      gap: TILE_ROW.gap,
      padding: TILE_ROW.padding,
      paddingLeft: TILE_ROW.paddingLeft,
    },
    card: {
      padding: space.four - cardBorderGrowth,
      borderWidth: cardBorderWidth,
      borderRadius: radius.eighteen,
      borderColor: selected ? theme.bg.strongPrimary : theme.border.soft,
      backgroundColor: theme.bg.softPrimary,
    },
    tile: {
      marginTop: TILE_ROW.tileOffset,
    },
    text: {
      gap: space.one,
    },
    incompatibleTitle: {
      color: theme.text.defaultTertiary,
    },
    badges: {
      marginTop: space.one,
    },
    progress: {
      marginTop: space.two,
      gap: space.two,
    },
    trailing: {
      width: CIRCLE_BUTTON_SIZE,
      alignItems: 'center',
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
    lockedSelection: {
      opacity: LOCKED_OPACITY,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.two,
    },
    updateButton: {
      minHeight: CIRCLE_BUTTON_SIZE,
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
};
