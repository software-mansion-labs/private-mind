import React from 'react';
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  StyleSheet,
  View,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import {
  useModelDownload,
  type WifiWarningSheetRef,
} from '../../hooks/useModelDownload';
import { useDeleteModelFiles } from '../../hooks/useDeleteModelFiles';
import { Theme } from '../../styles/colors';
import { dimmedOpacity } from '../../styles/pressable';
import { space } from '../../constants/design-system';
import { Model } from '../../database/modelRepository';
import { ModelState } from '../../store/modelStore';
import { isModelCompatible } from '../../utils/modelCompatibility';
import { getModelFamily } from '../../utils/modelFamily';
import { formatModelMeta } from '../../utils/modelMeta';
import CircleButton from '../CircleButton';
import ModelFamilyTile from './ModelFamilyTile';
import ModelRow from './ModelRow';
import ModelRowText from './ModelRowText';
import ModelCapabilityBadges from './ModelCapabilityBadges';
import DownloadedBadge from './DownloadedBadge';
import DownloadPercent from './DownloadPercent';
import DownloadProgressBar from './DownloadProgressBar';
import DownloadProgressDetails from './DownloadProgressDetails';
import { ROW_PADDING } from './RowGroup';
import DownloadArrowIcon from '../../assets/icons/download-arrow.svg';
import CloseIcon from '../../assets/icons/close.svg';
import TrashIcon from '../../assets/icons/trash.svg';

const ACTION_ICON_SIZE = 16;
const CANCEL_ICON_SIZE = 13.33;

interface Props {
  model: Model;
  onPress: (model: Model) => void;
  wifiWarningSheetRef?: WifiWarningSheetRef;
  showFamilyTile?: boolean;
}

const ModelDownloadRow = ({
  model,
  onPress,
  wifiWarningSheetRef,
  showFamilyTile = false,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const { status, progress, rate, startDownload, stopDownload } =
    useModelDownload(model, wifiWarningSheetRef);
  const { deleteModelFiles, ConfirmElement } = useDeleteModelFiles();

  const isCompatible = isModelCompatible(model);
  const isDownloaded = status === ModelState.Downloaded;
  const isDownloading = status === ModelState.Downloading;
  const canDownload = status === ModelState.NotStarted && isCompatible;
  const canDelete = isDownloaded && model.source !== 'local';
  const disabled = !isDownloaded && model.source === 'built-in';

  const accessibilityActions: AccessibilityActionInfo[] = [
    ...(canDownload ? [{ name: 'download', label: 'Download' }] : []),
    ...(isDownloading
      ? [{ name: 'cancelDownload', label: 'Cancel download' }]
      : []),
    ...(canDelete ? [{ name: 'delete', label: 'Delete model files' }] : []),
  ];

  const handleAccessibilityAction = ({
    nativeEvent,
  }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === 'download') startDownload();
    if (nativeEvent.actionName === 'cancelDownload') stopDownload();
    if (nativeEvent.actionName === 'delete') deleteModelFiles(model);
  };

  const titleAccessory = isDownloading ? (
    <DownloadPercent progress={progress} />
  ) : isDownloaded ? (
    <DownloadedBadge testID="model-download-row-downloaded" />
  ) : undefined;

  return (
    <ModelRow
      align="top"
      style={[styles.row, !isCompatible && dimmedOpacity]}
      onPress={() => onPress(model)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{
        disabled: disabled && accessibilityActions.length === 0,
      }}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={handleAccessibilityAction}
      testID={`model-download-row-${model.id}`}
    >
      {showFamilyTile && (
        <ModelFamilyTile family={getModelFamily(model)} size="list" />
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
      {status === ModelState.NotStarted && (
        <CircleButton
          onPress={isCompatible ? startDownload : undefined}
          backgroundColor={
            isCompatible ? theme.bg.accentSoft : theme.border.soft
          }
          color={isCompatible ? theme.text.accent : theme.text.defaultTertiary}
          icon={DownloadArrowIcon}
          size={ACTION_ICON_SIZE}
          disabled={!isCompatible}
          testID="model-download-row-download"
        />
      )}
      {isDownloading && (
        <CircleButton
          onPress={stopDownload}
          backgroundColor={theme.bg.tile}
          color={theme.text.primary}
          icon={CloseIcon}
          size={CANCEL_ICON_SIZE}
          testID="model-download-row-cancel"
        />
      )}
      {canDelete && (
        <CircleButton
          onPress={() => deleteModelFiles(model)}
          backgroundColor={theme.bg.errorSecondary}
          color={theme.text.error}
          icon={TrashIcon}
          size={ACTION_ICON_SIZE}
          testID="model-download-row-delete"
        />
      )}
      {ConfirmElement}
    </ModelRow>
  );
};

export default ModelDownloadRow;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    row: {
      padding: ROW_PADDING,
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
  });
