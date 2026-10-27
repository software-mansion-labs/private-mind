import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import { fontSizes, fontFamily, lineHeights } from '../../styles/fontStyles';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import {
  DownloadState,
  ModelState,
  useModelStore,
} from '../../store/modelStore';
import PrimaryButton from '../../components/PrimaryButton';
import StartingModelCard, {
  StartingDownloadStatus,
} from '../../components/onboarding/StartingModelCard';
import EntryButton from '../../components/EntryButton';
import { getNextChatId } from '../../database/chatRepository';
import { useChatStore } from '../../store/chatStore';
import { useLLMStore } from '../../store/llmStore';
import { Feedback } from '../../utils/Feedback';
import { useSQLiteContext } from 'expo-sqlite';
import { getModelsByNames, Model } from '../../database/modelRepository';
import { Theme } from '../../styles/colors';
import { getStartingModels } from '../../constants/default-models';
import {
  getDeviceMemoryGB,
  isModelCompatible,
} from '../../utils/modelCompatibility';
import { radius, space, stroke } from '../../constants/design-system';

const APP_ICON_SIZE = 72;
const SECTION_GAP = 28;
const CARD_BORDER_ROOM = stroke.strong;

const downloadLabel = (models: Model[]) => {
  if (models.length === 0) return 'Select a model';
  const noun = models.length === 1 ? 'model' : 'models';
  const totalGb = models.reduce(
    (sum, model) => sum + (model.modelSize ?? 0),
    0
  );
  return `Download ${models.length} ${noun} · ${totalGb.toFixed(2)} GB`;
};

type Phase = 'select' | 'downloading' | 'ready';

const isDownloadedIn = (
  {
    models,
    downloadStates,
  }: { models: Model[]; downloadStates: Record<string, DownloadState> },
  modelId: number
) =>
  downloadStates[modelId]?.status === ModelState.Downloaded ||
  models.some((model) => model.id === modelId && model.isDownloaded);

const isModelDownloaded = (modelId: number) =>
  isDownloadedIn(useModelStore.getState(), modelId);

function SelectStartingModelScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { styles } = useThemedStyles(createStyles);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [started, setStarted] = useState(false);
  const isContinuingRef = useRef(false);
  const { initPhantomChat } = useChatStore();
  const { setActiveChatId } = useLLMStore();
  const downloadModel = useModelStore((state) => state.downloadModel);
  const cancelDownload = useModelStore((state) => state.cancelDownload);
  const downloadStates = useModelStore((state) => state.downloadStates);
  const storeModels = useModelStore((state) => state.models);
  const [startingModels, setStartingModels] = useState<Model[] | null>(null);
  const suggestedStartingModelNames = useMemo(
    () => getStartingModels(getDeviceMemoryGB()),
    []
  );

  useEffect(() => {
    getModelsByNames(db, suggestedStartingModelNames).then((models) =>
      setStartingModels(models.filter(isModelCompatible))
    );
  }, [db, suggestedStartingModelNames]);

  const selectedModels = (startingModels ?? []).filter((model) =>
    selectedIds.includes(model.id)
  );

  const isDownloaded = (modelId: number) =>
    isDownloadedIn({ models: storeModels, downloadStates }, modelId);
  const isDownloading = (modelId: number) =>
    downloadStates[modelId]?.status === ModelState.Downloading;

  const phase: Phase = selectedModels.some((m) => isDownloading(m.id))
    ? 'downloading'
    : started && selectedModels.some((m) => isDownloaded(m.id))
      ? 'ready'
      : 'select';

  useEffect(() => {
    if (started && phase === 'select') setStarted(false);
  }, [started, phase]);

  const deselect = (modelId: number) =>
    setSelectedIds((ids) => ids.filter((id) => id !== modelId));

  const toggleModel = (model: Model) => {
    if (phase !== 'select') return;
    setSelectedIds((ids) =>
      ids.includes(model.id)
        ? ids.filter((id) => id !== model.id)
        : [...ids, model.id]
    );
  };

  const downloadSelected = async () => {
    const networkState = await NetInfo.fetch();
    if (!networkState.isConnected) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Models cannot be downloaded without internet connection.',
      });
      return;
    }

    setStarted(true);
    Feedback.downloadStart();

    await Promise.all(
      selectedModels
        .filter((model) => !isModelDownloaded(model.id))
        .map(async (model) => {
          await downloadModel(model);
          if (!isModelDownloaded(model.id)) deselect(model.id);
        })
    );
  };

  const handleCancel = async (model: Model) => {
    deselect(model.id);
    Feedback.cancelDownload();
    await cancelDownload(model);
  };

  const downloadStatusFor = (
    model: Model
  ): StartingDownloadStatus | undefined => {
    if (phase === 'select' || !selectedIds.includes(model.id)) return undefined;
    return isDownloaded(model.id) ? 'done' : 'downloading';
  };

  const handleStartChatting = async () => {
    const model = selectedModels.find((m) => isModelDownloaded(m.id));
    if (!model || isContinuingRef.current) return;
    isContinuingRef.current = true;

    try {
      const nextChatId = await getNextChatId(db);
      await initPhantomChat(nextChatId);
      await setActiveChatId(null);
      router.replace({
        pathname: `/chat/${nextChatId}`,
        params: { modelId: String(model.id) },
      });
    } finally {
      isContinuingRef.current = false;
    }
  };

  const totalSize = selectedModels.reduce(
    (sum, model) => sum + (model.modelSize ?? 0),
    0
  );
  const downloadedSize = selectedModels.reduce(
    (sum, model) =>
      sum +
      (model.modelSize ?? 0) *
        (isDownloaded(model.id)
          ? 1
          : (downloadStates[model.id]?.progress ?? 0)),
    0
  );
  const overallPercent =
    totalSize > 0 ? Math.floor((downloadedSize / totalSize) * 100) : 0;

  const primaryButton = {
    select: {
      text: downloadLabel(selectedModels),
      onPress: downloadSelected,
      disabled: selectedModels.length === 0,
    },
    downloading: {
      text: `Downloading… ${overallPercent}%`,
      onPress: () => {},
      disabled: true,
    },
    ready: {
      text: 'Start chatting',
      onPress: handleStartChatting,
      disabled: false,
    },
  }[phase];

  const handleSkip = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/icons/icon.png')}
            style={styles.appIcon}
            testID="starting-model-app-icon"
          />
          <Text style={styles.title}>Choose a starting model</Text>
          <Text style={styles.description}>
            Download your first model to get started with Private Mind.
          </Text>
        </View>

        <ScrollView
          style={styles.modelsScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.modelsContainer}>
            {startingModels?.length === 0 && (
              <Text style={styles.noModelsFit}>
                No suggested model fits this device's memory.
              </Text>
            )}
            {startingModels?.map((model) => (
              <StartingModelCard
                key={model.id}
                model={model}
                onPress={toggleModel}
                selected={selectedIds.includes(model.id)}
                locked={phase !== 'select'}
                downloadStatus={downloadStatusFor(model)}
                onCancel={handleCancel}
                onDeleted={(deleted) => deselect(deleted.id)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          text={primaryButton.text}
          onPress={primaryButton.onPress}
          disabled={primaryButton.disabled}
        />
        <EntryButton
          style={styles.skipButton}
          text="Skip for now"
          onPress={handleSkip}
        />
      </View>
    </View>
  );
}

export default SelectStartingModelScreen;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: space.four,
      paddingBottom: theme.insets.bottom,
      gap: SECTION_GAP,
      backgroundColor: theme.bg.softPrimary,
    },
    content: {
      flex: 1,
      gap: SECTION_GAP,
      paddingTop: space.six,
    },
    header: {
      gap: space.three,
      paddingHorizontal: space.six,
    },
    appIcon: {
      width: APP_ICON_SIZE,
      height: APP_ICON_SIZE,
      borderRadius: radius.eighteen,
      alignSelf: 'center',
      marginBottom: space.two,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xl,
      lineHeight: lineHeights.xl,
      textAlign: 'center',
      color: theme.text.primary,
    },
    description: {
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
      textAlign: 'center',
    },
    modelsScroll: {
      margin: -CARD_BORDER_ROOM,
    },
    noModelsFit: {
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
      textAlign: 'center',
    },
    modelsContainer: {
      gap: 8,
      padding: CARD_BORDER_ROOM,
    },
    footer: {
      gap: 10,
      backgroundColor: theme.bg.softPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    skipButton: {
      justifyContent: 'center',
      alignItems: 'center',
      height: 48,
      paddingHorizontal: 10,
    },
  });
