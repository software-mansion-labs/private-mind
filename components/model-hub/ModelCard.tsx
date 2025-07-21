import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import DeviceInfo from 'react-native-device-info';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { Model } from '../../database/modelRepository';
import { ModelState, useModelStore } from '../../store/modelStore';
import Chip from '../Chip';
import CircleButton from '../CircleButton';
import ProcessorIcon from '../../assets/icons/processor.svg';
import DownloadCloudIcon from '../../assets/icons/download_cloud.svg';
import DownloadIcon from '../../assets/icons/download.svg';
import StarIcon from '../../assets/icons/star.svg';
import CloseIcon from '../../assets/icons/close.svg';

const MEMORY_TO_PARAMETERS_RATIO = 2.5;
const TOTAL_MEMORY = DeviceInfo.getTotalMemorySync() / 1024 / 1024 / 1024; // in GB

interface Props {
  model: Model;
  onPress: (model: Model) => void;
  bottomSheetModalRef?: React.RefObject<any>;
}

const ModelCard = ({ model, onPress, bottomSheetModalRef }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { downloadStates, downloadModel, cancelDownload } = useModelStore();

  const downloadState = downloadStates[model.id] || {
    progress: model.isDownloaded ? 1 : 0,
    status: model.isDownloaded ? ModelState.Downloaded : ModelState.NotStarted,
  };

  const isDownloading = downloadState.status === ModelState.Downloading;

  const [modelState, setModelState] = useState<ModelState>(
    isDownloading
      ? ModelState.Downloading
      : !model.isDownloaded
      ? ModelState.NotStarted
      : ModelState.Downloaded
  );

  useEffect(() => {
    setModelState(downloadState.status);
  }, [downloadState.status]);

  const handlePress = async () => {
    if (isDownloading) {
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

    const estimatedRequiredMemory =
      model.parameters && model.parameters * MEMORY_TO_PARAMETERS_RATIO;

    if (
      estimatedRequiredMemory &&
      estimatedRequiredMemory > TOTAL_MEMORY &&
      bottomSheetModalRef?.current
    ) {
      bottomSheetModalRef.current?.present(model);
    } else {
      await downloadModel(model);
    }
  };

  const disabled =
    modelState !== ModelState.Downloaded && model.source === 'built-in';

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: theme.border.soft }]}
      onPress={() => onPress(model)}
      disabled={disabled}
    >
      <View style={styles.topRow}>
        <View style={styles.titleSection}>
          <Text style={styles.name}>{model.modelName}</Text>
          <View style={styles.chipContainer}>
            {model.parameters && (
              <Chip
                title={`${model.parameters.toFixed(2)} B`}
                icon={
                  <ProcessorIcon
                    width={16}
                    height={16}
                    style={styles.iconSecondary}
                  />
                }
              />
            )}
            {model.modelSize && (
              <Chip
                title={`${model.modelSize.toFixed(2)} GB`}
                icon={
                  <DownloadCloudIcon
                    width={16}
                    height={16}
                    style={styles.iconSecondary}
                  />
                }
                borderColor={theme.border.soft}
              />
            )}
            {model.featured && (
              <Chip
                title="Featured"
                icon={
                  <StarIcon
                    width={13.33}
                    height={13.33}
                    style={styles.iconSecondary}
                  />
                }
                borderColor={theme.border.soft}
              />
            )}
          </View>
        </View>

        {modelState === ModelState.Downloading && (
          <CircleButton
            onPress={handlePress}
            backgroundColor={theme.bg.errorSecondary}
            icon={
              <CloseIcon
                width={13.33}
                height={13.33}
                style={styles.iconPrimary}
              />
            }
          />
        )}

        {modelState === ModelState.NotStarted && (
          <CircleButton
            onPress={handlePress}
            backgroundColor={theme.bg.softSecondary}
            icon={
              <DownloadIcon width={15} height={15} style={styles.iconPrimary} />
            }
          />
        )}
      </View>

      {modelState === ModelState.Downloading && (
        <View style={styles.progressRow}>
          <View
            style={[
              styles.progressBarContainer,
              { backgroundColor: theme.bg.softSecondary },
            ]}
          >
            <View
              style={[
                styles.progressBar,
                {
                  width: `${downloadState.progress * 100}%`,
                  backgroundColor: theme.bg.strongPrimary,
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.floor(downloadState.progress * 100)}%
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default ModelCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      padding: 16,
      borderWidth: 1,
      borderRadius: 12,
      flexDirection: 'column',
      gap: 16,
    },
    name: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    iconPrimary: {
      color: theme.text.primary,
    },
    iconSecondary: {
      color: theme.text.defaultSecondary,
    },
    titleSection: {
      gap: 4,
    },
    chipContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    progressBarContainer: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
      width: '85%',
    },
    progressBar: {
      height: '100%',
    },
    progressText: {
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
  });
