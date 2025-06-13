import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

interface Props {
  model: Model;
}

const ModelCard = ({ model }: Props) => {
  const { downloadStates, downloadModel, removeModel } = useModelStore();
  const { theme } = useTheme();

  const downloadState = downloadStates[model.id] || {
    progress: 0,
    status: ModelState.NotStarted,
  };

  const isDownloading = downloadState.status === ModelState.Downloading;

  const [modelState, setModelState] = useState<ModelState>(
    isDownloading
      ? ModelState.Downloading
      : model.isDownloaded === 1
      ? ModelState.Downloaded
      : ModelState.NotStarted
  );
  useEffect(() => {
    if (downloadState.status === 'downloaded') {
      setModelState(ModelState.Downloaded);
    }
  }, [downloadState.status]);

  const handlePress = async () => {
    if (isDownloading) return;
    if (modelState === ModelState.Downloaded) {
      await deleteModel();
    } else {
      await downloadModel(model);
    }
  };

  const deleteModel = async () => {
    try {
      await removeModel(model.id);
      setModelState(ModelState.NotStarted);
    } catch (error) {
      console.error('Failed to delete model:', error);
    }
  };

  return (
    <View style={{ ...styles.card, borderColor: theme.border.soft }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ ...styles.name, color: theme.text.primary }}>
            {model.id}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Chip
              title={'0.6 B'}
              icon={<ProcessorIcon width={16} height={16} />}
            />
            {modelState === ModelState.NotStarted && (
              <Chip
                title={'2.47 GB'}
                icon={<DownloadCloudIcon width={16} height={16} />}
              />
            )}
            <Text
              style={{
                fontFamily: fontFamily.regular,
                fontSize: fontSizes.xs,
                color: theme.text.defaultSecondary,
              }}
            >
              ·
            </Text>
            <Text
              style={{
                ...styles.sourceText,
                color: theme.text.defaultSecondary,
              }}
            >
              Built-in
            </Text>
          </View>
        </View>
        {isDownloading ? (
          <CircleButton
            onPress={() => {}}
            backgroundColor={theme.bg.errorSecondary}
            icon={<CloseIcon width={13.33} height={13.33} />}
          />
        ) : (
          modelState === ModelState.NotStarted && (
            <CircleButton
              onPress={handlePress}
              icon={<DownloadIcon width={15} height={15} />}
              backgroundColor={theme.bg.softSecondary}
            />
          )
        )}
      </View>
      {isDownloading && (
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
    </View>
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
