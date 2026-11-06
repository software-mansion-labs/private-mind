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
import ModelDownloadRow from '../../components/model-hub/ModelDownloadRow';
import SectionHeader from '../../components/model-hub/SectionHeader';
import StartingFeatureList from '../../components/onboarding/StartingFeatureList';
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
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../constants/design-system';
import {
  formatDownloadPercent,
  hasDownloadStarted,
} from '../../utils/downloadProgress';
import {
  STARTING_FEATURE_KEYS,
  StartingFeature,
  StartingFeatureKey,
  useStartingFeatures,
} from '../../hooks/useStartingFeatures';

const APP_ICON_SIZE = 72;
const SECTION_GAP = 28;
const CARD_BORDER_ROOM = stroke.strong;

const downloadLabel = (models: Model[], features: StartingFeature[]) => {
  if (models.length === 0) return 'Select a model';
  const count = models.length + features.length;
  const noun = count === 1 ? 'model' : 'models';
  const totalGb =
    models.reduce((sum, model) => sum + (model.modelSize ?? 0), 0) +
    features.reduce((sum, feature) => sum + feature.sizeGb, 0);
  return `Download ${count} ${noun} · ${totalGb.toFixed(2)} GB`;
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
  const [selectedFeatureKeys, setSelectedFeatureKeys] = useState<
    StartingFeatureKey[]
  >(STARTING_FEATURE_KEYS);
  const [startedFeatureKeys, setStartedFeatureKeys] = useState<
    StartingFeatureKey[]
  >([]);
  const {
    features,
    download: downloadFeature,
    cancel: cancelFeature,
  } = useStartingFeatures();
  const isContinuingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const revealFeaturesRef = useRef(false);
  const cancelledFeaturesRef = useRef(new Set<StartingFeatureKey>());
  const { initPhantomChat } = useChatStore();
  const { setActiveChatId } = useLLMStore();
  const downloadModel = useModelStore((state) => state.downloadModel);
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

  const featuresToDownload = features.filter(
    (feature) =>
      feature.status === 'available' &&
      selectedFeatureKeys.includes(feature.key)
  );
  const startedFeatures = features.filter((feature) =>
    startedFeatureKeys.includes(feature.key)
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

  const dropFeature = (key: StartingFeatureKey) => {
    setSelectedFeatureKeys((keys) => keys.filter((k) => k !== key));
    setStartedFeatureKeys((keys) => keys.filter((k) => k !== key));
  };

  const toggleFeature = (key: StartingFeatureKey) => {
    if (phase !== 'select') return;
    setSelectedFeatureKeys((keys) =>
      keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
    );
  };

  const selectAllFeatures = (selected: boolean) => {
    if (phase !== 'select') return;
    setSelectedFeatureKeys(selected ? STARTING_FEATURE_KEYS : []);
  };

  const revealFeatures = () => {
    revealFeaturesRef.current = true;
  };

  const scrollToRevealedFeatures = () => {
    if (!revealFeaturesRef.current) return;
    revealFeaturesRef.current = false;
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const stopFeature = async (key: StartingFeatureKey) => {
    Feedback.cancelDownload();
    cancelledFeaturesRef.current.add(key);
    dropFeature(key);
    await cancelFeature(key);
  };

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
    setStartedFeatureKeys(featuresToDownload.map((feature) => feature.key));
    Feedback.downloadStart();

    await Promise.all([
      ...selectedModels
        .filter((model) => !isModelDownloaded(model.id))
        .map(async (model) => {
          await downloadModel(model);
          if (!isModelDownloaded(model.id)) deselect(model.id);
        }),
      ...featuresToDownload.map(async (feature) => {
        const finished = await downloadFeature(feature.key);
        if (cancelledFeaturesRef.current.delete(feature.key)) return;
        if (!finished) dropFeature(feature.key);
      }),
    ]);
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

  const totalSize =
    selectedModels.reduce((sum, model) => sum + (model.modelSize ?? 0), 0) +
    startedFeatures.reduce((sum, feature) => sum + feature.sizeGb, 0);
  const downloadedSize =
    selectedModels.reduce(
      (sum, model) =>
        sum +
        (model.modelSize ?? 0) *
          (isDownloaded(model.id)
            ? 1
            : (downloadStates[model.id]?.progress ?? 0)),
      0
    ) +
    startedFeatures.reduce(
      (sum, feature) => sum + feature.sizeGb * feature.progress,
      0
    );
  const featuresAlreadyOnPhone =
    startedFeatures.length === 0 &&
    features.every((feature) => feature.status === 'downloaded');
  const overallProgress = totalSize > 0 ? downloadedSize / totalSize : 0;

  const primaryButton = {
    select: {
      text: downloadLabel(selectedModels, featuresToDownload),
      onPress: downloadSelected,
      disabled: selectedModels.length === 0,
    },
    downloading: {
      text: hasDownloadStarted(overallProgress)
        ? `Downloading… ${formatDownloadPercent(overallProgress)}`
        : 'Starting download…',
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
          ref={scrollRef}
          style={styles.modelsScroll}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToRevealedFeatures}
        >
          <View style={styles.sections}>
            <View style={styles.section}>
              <SectionHeader title="Chat models" />
              {startingModels?.length === 0 && (
                <Text style={styles.noModelsFit}>
                  No suggested model fits this device's memory.
                </Text>
              )}
              {startingModels?.map((model) => (
                <ModelDownloadRow
                  key={model.id}
                  model={model}
                  onPress={toggleModel}
                  showFamilyTile
                  selection={{
                    selected: selectedIds.includes(model.id),
                    locked: phase !== 'select',
                  }}
                  onCancelled={(cancelled) => deselect(cancelled.id)}
                  onDeleted={(deleted) => deselect(deleted.id)}
                />
              ))}
            </View>
            {!featuresAlreadyOnPhone && (
              <View style={styles.section}>
                <StartingFeatureList
                  features={features}
                  selectedKeys={selectedFeatureKeys}
                  startedKeys={startedFeatureKeys}
                  locked={phase !== 'select'}
                  onToggle={toggleFeature}
                  onSelectAll={selectAllFeatures}
                  onCancel={stopFeature}
                  onExpand={revealFeatures}
                />
                <Text style={styles.caption}>
                  Optional. You can still get these later.
                </Text>
              </View>
            )}
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
    sections: {
      gap: space.five,
      padding: CARD_BORDER_ROOM,
    },
    section: {
      gap: space.two,
    },
    caption: {
      ...textStyles.bodyTertiaryRegular,
      color: theme.text.defaultTertiary,
      paddingHorizontal: space.one,
    },
    footer: {
      gap: space.twoHalf,
      backgroundColor: theme.bg.softPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    skipButton: {
      justifyContent: 'center',
      alignItems: 'center',
      height: 48,
      paddingHorizontal: space.twoHalf,
    },
  });
