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
import { useConfirm } from '../../hooks/useConfirm';
import Chip from '../Chip';
import CircleButton from '../CircleButton';
import CapabilityBadge, { modelCapabilities } from './CapabilityBadge';
import { ROW_PADDING } from './RowGroup';
import DownloadIcon from '../../assets/icons/download.svg';
import CloseIcon from '../../assets/icons/close.svg';
import TrashIcon from '../../assets/icons/trash.svg';
import CheckIcon from '../../assets/icons/check.svg';
import { Feedback } from '../../utils/Feedback';
import {
  iconSize,
  opacity,
  radius,
  space,
} from '../../constants/design-system';

export type ModelCardVariant = 'card' | 'row';

const CHECK_BADGE_SIZE = 32;

interface Props {
  model: Model;
  compactView?: boolean;
  selected?: boolean;
  onPress: (model: Model) => void;
  wifiWarningSheetRef?: React.RefObject<BottomSheetModal<WarningSheetData> | null>;
  showDeleteButton?: boolean;
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
  variant = 'card',
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles, selected, variant);

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
  };

  const isCompatible = isModelCompatible(model);
  const disabled =
    modelState !== ModelState.Downloaded && model.source === 'built-in';
  const meta = modelMeta(model);
  const capabilities = modelCapabilities(model, { withLabels: !compactView });
  const isDownloaded = modelState === ModelState.Downloaded;
  const canDeleteFiles =
    showDeleteButton && isDownloaded && model.source !== 'local';

  return (
    <TouchableOpacity
      style={[styles.container, !isCompatible && styles.incompatible]}
      onPress={() => onPress(model)}
      disabled={disabled}
      activeOpacity={opacity.pressed}
    >
      <View style={styles.topRow}>
        <View style={styles.info}>
          <Text style={[styles.name, !isCompatible && styles.incompatibleText]}>
            {model.modelName}
          </Text>
          {meta.length > 0 && <Text style={styles.meta}>{meta}</Text>}
          {(!isCompatible || capabilities.length > 0) && (
            <View style={styles.badges}>
              {!isCompatible && (
                <Chip
                  title="Incompatible"
                  borderColor={theme.text.error}
                  backgroundColor={theme.bg.errorSecondary}
                  textColor={theme.text.error}
                />
              )}
              {capabilities.map((capability) => (
                <CapabilityBadge key={capability.label} {...capability} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.trailing}>
          {isDownloading && (
            <CircleButton
              onPress={handlePress}
              backgroundColor={theme.bg.errorSecondary}
              color={theme.text.primary}
              icon={CloseIcon}
              size={13.33}
            />
          )}

          {modelState === ModelState.NotStarted && (
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

          {canDeleteFiles && (
            <CircleButton
              onPress={handleDelete}
              backgroundColor="transparent"
              color={theme.text.defaultTertiary}
              icon={TrashIcon}
              size={iconSize.sm}
              testID="model-delete-files"
            />
          )}

          {isDownloaded && !compactView && (
            <View style={styles.check} testID="model-downloaded-check">
              <CheckIcon
                width={iconSize.sm}
                height={iconSize.sm}
                style={styles.checkIcon}
              />
            </View>
          )}
        </View>
      </View>

      {isDownloading && (
        <View style={styles.progressRow}>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                { width: `${downloadState.progress * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.floor(downloadState.progress * 100)}%
          </Text>
        </View>
      )}

      {showDeleteButton && ConfirmElement}
    </TouchableOpacity>
  );
};

export default ModelCard;

const createStyles = (
  theme: Theme,
  selected: boolean,
  variant: ModelCardVariant
) =>
  StyleSheet.create({
    container:
      variant === 'row'
        ? {
            paddingHorizontal: ROW_PADDING,
            paddingVertical: space.three,
            gap: space.three,
            backgroundColor: selected ? theme.bg.softSecondary : undefined,
          }
        : {
            padding: space.four,
            borderWidth: 1,
            borderRadius: radius.twelve,
            borderColor: selected ? theme.bg.strongPrimary : theme.border.soft,
            gap: space.three,
          },
    incompatible: {
      opacity: opacity.disabled,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
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
    incompatibleText: {
      color: theme.text.defaultTertiary,
    },
    meta: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultSecondary,
    },
    badges: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: space.one,
      marginTop: space.one,
    },
    trailing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.one,
    },
    check: {
      width: CHECK_BADGE_SIZE,
      height: CHECK_BADGE_SIZE,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.softSecondary,
    },
    checkIcon: {
      color: theme.text.primary,
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
      backgroundColor: theme.bg.softSecondary,
    },
    progressBar: {
      height: '100%',
      backgroundColor: theme.bg.strongPrimary,
    },
    progressText: {
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
  });
