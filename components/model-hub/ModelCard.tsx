import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Model } from '../../database/modelRepository';
import { ModelState, useModelStore } from '../../store/modelStore';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import Chip from '../Chip';
import ProcessorIcon from '../../assets/icons/processor.svg';
import DownloadCloudIcon from '../../assets/icons/download_cloud.svg';
import DownloadIcon from '../../assets/icons/download.svg';
import CircleButton from '../CircleButton';
import CloseIcon from '../../assets/icons/close.svg';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';

interface Props {
  model: Model;
  onPress: (model: Model) => void;
}

const ModelCard = ({ model, onPress }: Props) => {
  const { downloadStates, downloadModel } = useModelStore();
  const { theme } = useTheme();
  const downloadState = downloadStates[model.id] || {
    progress: model.isDownloaded ? 1 : 0,
    status: model.isDownloaded ? ModelState.Downloaded : ModelState.NotStarted,
  };

  const isDownloading = downloadState.status === ModelState.Downloading;

  const [modelState, setModelState] = useState<ModelState>(
    isDownloading
      ? ModelState.Downloading
      : model.isDownloaded === 0
      ? ModelState.NotStarted
      : ModelState.Downloaded
  );

  useEffect(() => {
    if (downloadState.status === ModelState.Downloaded) {
      setModelState(ModelState.Downloaded);
    } else if (downloadState.status === ModelState.NotStarted) {
      setModelState(ModelState.NotStarted);
    } else if (downloadState.status === ModelState.Downloading) {
      setModelState(ModelState.Downloading);
    }
  }, [downloadState.status]);

  const handlePress = async () => {
    if (isDownloading) return;
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      Toast.show({
        type: 'defaultToast',
        text1: `Model cannot be downloaded without internet connection.`,
      });

      return;
    }
    await downloadModel(model);
  };

  return (
    <TouchableOpacity
      onPress={() => {
        onPress(model);
      }}
      style={{ ...styles.card, borderColor: theme.border.soft }}
      disabled={modelState !== ModelState.Downloaded}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ ...styles.name, color: theme.text.primary }}>
            {model.modelName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {model.parameters && (
              <Chip
                title={model.parameters.toFixed(2) + ' B'}
                icon={
                  <ProcessorIcon
                    width={16}
                    height={16}
                    style={{ color: theme.text.defaultSecondary }}
                  />
                }
              />
            )}
            {modelState === ModelState.NotStarted && model.modelSize && (
              <Chip
                title={model.modelSize.toFixed(2) + ' GB'}
                icon={
                  <DownloadCloudIcon
                    width={16}
                    height={16}
                    style={{ color: theme.text.defaultSecondary }}
                  />
                }
                borderColor={theme.border.soft}
              />
            )}
          </View>
        </View>
        {/* {modelState === ModelState.Downloading && (
          <CircleButton
            onPress={() => {}}
            backgroundColor={theme.bg.errorSecondary}
            icon={
              <CloseIcon
                width={13.33}
                height={13.33}
                style={{ color: theme.text.primary }}
              />
            }
          />
        )} */}
        {modelState === ModelState.NotStarted && (
          <CircleButton
            onPress={handlePress}
            icon={
              <DownloadIcon
                width={15}
                height={15}
                style={{ color: theme.text.primary }}
              />
            }
            backgroundColor={theme.bg.softSecondary}
          />
        )}
      </View>
      {modelState === ModelState.Downloading && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              ...styles.progressBarContainer,
              backgroundColor: theme.bg.softSecondary,
            }}
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
          <Text
            style={{
              ...styles.progressText,
              color: theme.text.defaultSecondary,
            }}
          >
            {Math.floor(downloadState.progress * 100)}%
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default ModelCard;

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 4,
    gap: 16,
    flexDirection: 'column',
  },
  name: {
    fontFamily: fontFamily.medium,
    fontSize: fontSizes.md,
  },
  sourceText: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.regular,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    width: '85%',
  },
  progressBar: {
    height: '100%',
  },
  progressText: {
    fontSize: fontSizes.xs,
    fontFamily: fontFamily.regular,
  },
});
