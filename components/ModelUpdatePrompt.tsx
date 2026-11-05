import React, { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pressedOpacity } from '../styles/pressable';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../styles/fontStyles';
import { radius, space } from '../constants/design-system';
import { MODEL_UPDATE_TEXT } from '../constants/model-update';
import { type Model } from '../database/modelRepository';
import {
  type DownloadState,
  ModelState,
  useModelStore,
} from '../store/modelStore';
import { modelsToUpdate, updateSizeGB } from '../utils/modelUpdate';
import PrimaryButton from './PrimaryButton';

const progressLabel = (state?: DownloadState) =>
  state?.status === ModelState.Downloading
    ? `${Math.round(state.progress * 100)}%`
    : MODEL_UPDATE_TEXT.waiting;

const remainingUpdates = () => {
  const { models, retiredModels } = useModelStore.getState();
  return modelsToUpdate(models, retiredModels);
};

const ModelUpdateRow = ({
  model,
  state,
}: {
  model: Model;
  state?: DownloadState;
}) => {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.row} testID={`model-update-row-${model.id}`}>
      <Text style={styles.rowName}>{model.modelName}</Text>
      <Text style={styles.rowMeta}>
        {`${(model.modelSize ?? 0).toFixed(2)} GB · ${progressLabel(state)}`}
      </Text>
    </View>
  );
};

const ModelUpdatePrompt = ({ children }: { children: ReactNode }) => {
  const { styles } = useThemedStyles(createStyles);
  const models = useModelStore((state) => state.models);
  const retiredModels = useModelStore((state) => state.retiredModels);
  const downloadStates = useModelStore((state) => state.downloadStates);
  const updateOutdatedModels = useModelStore(
    (state) => state.updateOutdatedModels
  );
  const toUpdate = modelsToUpdate(models, retiredModels);
  const [heldAtLaunch] = useState(() => toUpdate.length > 0);
  const [failed, setFailed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!heldAtLaunch || dismissed || toUpdate.length === 0)
    return <>{children}</>;

  const updating = toUpdate.some(
    (model) => downloadStates[model.id]?.status === ModelState.Downloading
  );

  const handleLater = () => setDismissed(true);

  const handleUpdate = async () => {
    setFailed(false);
    await updateOutdatedModels();
    setFailed(remainingUpdates().length > 0);
  };

  return (
    <View style={styles.screen} testID="model-update-prompt">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{MODEL_UPDATE_TEXT.title}</Text>
        <Text style={styles.body}>
          {MODEL_UPDATE_TEXT.body(toUpdate.length, updateSizeGB(toUpdate))}
        </Text>
        {retiredModels.map(({ modelName, replacement }) => (
          <Text key={modelName} style={styles.body}>
            {MODEL_UPDATE_TEXT.retired(modelName, replacement)}
          </Text>
        ))}
        <View style={styles.list}>
          {toUpdate.map((model) => (
            <ModelUpdateRow
              key={model.id}
              model={model}
              state={downloadStates[model.id]}
            />
          ))}
        </View>
        {failed && !updating && (
          <Text style={styles.error}>{MODEL_UPDATE_TEXT.failed}</Text>
        )}
      </ScrollView>
      <PrimaryButton
        text={
          updating
            ? MODEL_UPDATE_TEXT.inProgress(toUpdate.length)
            : MODEL_UPDATE_TEXT.action(toUpdate.length)
        }
        onPress={handleUpdate}
        disabled={updating}
      />
      <Pressable
        onPress={handleLater}
        accessibilityRole="button"
        style={({ pressed }) => [styles.later, pressed && pressedOpacity]}
      >
        <Text style={styles.laterText}>{MODEL_UPDATE_TEXT.later}</Text>
      </Pressable>
    </View>
  );
};

export default ModelUpdatePrompt;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      paddingTop: theme.insets.top + space.six,
      paddingBottom: theme.insets.bottom + space.four,
      paddingHorizontal: space.four,
      gap: space.four,
      backgroundColor: theme.bg.softPrimary,
    },
    content: {
      gap: space.three,
    },
    title: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.xl,
      lineHeight: lineHeights.xl,
      color: theme.text.primary,
    },
    body: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.defaultSecondary,
    },
    list: {
      gap: space.two,
    },
    row: {
      gap: space.one,
      padding: space.three,
      borderRadius: radius.twelve,
      backgroundColor: theme.bg.softTertiary,
    },
    rowName: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
    rowMeta: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultTertiary,
    },
    later: {
      alignItems: 'center',
      paddingVertical: space.two,
    },
    laterText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.defaultSecondary,
    },
    error: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.error,
    },
  });
