import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../styles/fontStyles';
import { space } from '../constants/design-system';
import { MODEL_UPDATE_TEXT } from '../constants/model-update';
import { ModelState, useModelStore } from '../store/modelStore';
import {
  modelsNeedingUpdate,
  pendingRetiredNotices,
  replacementsToDownload,
  updateSizeGB,
} from '../utils/modelUpdate';
import PrimaryButton from './PrimaryButton';

const ModelUpdateNotice = () => {
  const { styles } = useThemedStyles(createStyles);
  const models = useModelStore((state) => state.models);
  const retiredModels = useModelStore((state) => state.retiredModels);
  const downloadStates = useModelStore((state) => state.downloadStates);
  const updateOutdatedModels = useModelStore(
    (state) => state.updateOutdatedModels
  );

  const toDownload = [
    ...modelsNeedingUpdate(models),
    ...replacementsToDownload(retiredModels, models),
  ];
  const notices = pendingRetiredNotices(retiredModels, models);
  if (toDownload.length === 0) return null;

  const updating = toDownload.some(
    (model) => downloadStates[model.id]?.status === ModelState.Downloading
  );

  return (
    <View style={styles.container} testID="model-update-notice">
      {toDownload.length > 0 && (
        <Text style={styles.title}>{MODEL_UPDATE_TEXT.title}</Text>
      )}
      {notices.map(({ modelName, replacement }) => (
        <Text key={modelName} style={styles.body}>
          {MODEL_UPDATE_TEXT.retired(modelName, replacement)}
        </Text>
      ))}
      {toDownload.length > 0 && (
        <>
          <Text style={styles.body}>
            {MODEL_UPDATE_TEXT.body(
              toDownload.length,
              updateSizeGB(toDownload)
            )}
          </Text>
          <PrimaryButton
            text={
              updating
                ? MODEL_UPDATE_TEXT.inProgress(toDownload.length)
                : MODEL_UPDATE_TEXT.action(toDownload.length)
            }
            onPress={updateOutdatedModels}
            disabled={updating}
          />
        </>
      )}
    </View>
  );
};

export default ModelUpdateNotice;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: space.two,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
    body: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultSecondary,
    },
  });
