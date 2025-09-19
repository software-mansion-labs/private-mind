import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { fontSizes, fontFamily } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { useModelStore } from '../../store/modelStore';
import PrimaryButton from '../../components/PrimaryButton';
import ModelCard from '../../components/model-hub/ModelCard';
import EntryButton from '../../components/EntryButton';
import { getNextChatId } from '../../database/chatRepository';
import { useChatStore } from '../../store/chatStore';
import { useLLMStore } from '../../store/llmStore';
import { useSQLiteContext } from 'expo-sqlite';
import { getStartingModels, Model } from '../../database/modelRepository';

function SelectStartingModelScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { initPhantomChat } = useChatStore();
  const { setActiveChatId } = useLLMStore();
  const { downloadedModels } = useModelStore();
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [startingModels, setStartingModels] = useState<Model[]>([]);

  useEffect(() => {
    getStartingModels(db).then((models) => setStartingModels(models));
  }, [db]);

  useEffect(() => {
    if (downloadedModels.length === 1) setSelectedModel(downloadedModels[0]);
  }, [downloadedModels]);

  const handleContinue = async () => {
    if (!selectedModel) return;

    const nextChatId = await getNextChatId(db);
    await initPhantomChat(nextChatId);
    await setActiveChatId(null);
    router.replace({
      pathname: `/chat/${nextChatId}`,
      params: { modelId: downloadedModels[0].id },
    });
  };

  const handleSkip = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose a starting model</Text>
          <Text style={styles.description}>
            Download your first model to get started with Private Mind.
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.modelsContainer}>
            {startingModels.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                onPress={() => {}}
                compactView={false}
                selected={selectedModel?.id === model.id}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          text="Start chatting"
          onPress={handleContinue}
          disabled={!selectedModel}
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

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      paddingBottom: theme.insets.bottom,
      backgroundColor: theme.bg.softPrimary,
    },
    content: {
      flex: 1,
      gap: 24,
      paddingTop: 24,
    },
    header: {
      gap: 12,
      paddingHorizontal: 40,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xl,
      textAlign: 'center',
      color: theme.text.primary,
    },
    description: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
      textAlign: 'center',
    },
    modelsContainer: {
      gap: 8,
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
