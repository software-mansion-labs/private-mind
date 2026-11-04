import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../styles/fontStyles';
import { space } from '../constants/design-system';
import { MODEL_UPDATE_TEXT } from '../constants/model-update';
import { ModelState, useModelStore } from '../store/modelStore';
import { modelsNeedingUpdate, updateSizeGB } from '../utils/modelUpdate';
import PrimaryButton from './PrimaryButton';

const ModelUpdateNotice = () => {
  const { styles } = useThemedStyles(createStyles);
  const models = useModelStore((state) => state.models);
  const downloadStates = useModelStore((state) => state.downloadStates);
  const updateOutdatedModels = useModelStore(
    (state) => state.updateOutdatedModels
  );

  const outdated = modelsNeedingUpdate(models);
  if (outdated.length === 0) return null;

  const updating = outdated.some(
    (model) => downloadStates[model.id]?.status === ModelState.Downloading
  );

  return (
    <View style={styles.container} testID="model-update-notice">
      <Text style={styles.title}>{MODEL_UPDATE_TEXT.title}</Text>
      <Text style={styles.body}>
        {MODEL_UPDATE_TEXT.body(outdated.length, updateSizeGB(outdated))}
      </Text>
      <PrimaryButton
        text={
          updating
            ? MODEL_UPDATE_TEXT.inProgress(outdated.length)
            : MODEL_UPDATE_TEXT.action(outdated.length)
        }
        onPress={updateOutdatedModels}
        disabled={updating}
      />
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
