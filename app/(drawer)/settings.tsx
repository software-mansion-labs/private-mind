import React, { useCallback } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { router, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import useDefaultHeader from '../../hooks/useDefaultHeader';
import { SettingsRow } from '../../components/settings/SettingsRow';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { SettingsToggleRow } from '../../components/settings/SettingsToggleRow';
import { SettingsChoiceRow } from '../../components/settings/SettingsChoiceRow';
import EditIcon from '../../assets/icons/edit.svg';
import InfoCircleIcon from '../../assets/icons/info-circle.svg';
import BenchmarkIcon from '../../assets/icons/benchmark.svg';
import DownloadIcon from '../../assets/icons/download.svg';
import TrashIcon from '../../assets/icons/trash.svg';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useConfirm } from '../../hooks/useConfirm';
import { useImportChat } from '../../hooks/useImportChat';
import { useVectorStore } from '../../context/VectorStoreContext';
import { useChatStore } from '../../store/chatStore';
import { useLLMStore } from '../../store/llmStore';
import {
  type ThemePreference,
  useSettingsStore,
} from '../../store/settingsStore';
import { Feedback } from '../../utils/Feedback';
import { Theme } from '../../styles/colors';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const SettingsScreen = () => {
  useDefaultHeader();
  const navigation = useRouter();
  const { styles } = useThemedStyles(createStyles);
  const showPerformanceMetrics = useSettingsStore(
    (state) => state.showPerformanceMetrics
  );
  const setShowPerformanceMetrics = useSettingsStore(
    (state) => state.setShowPerformanceMetrics
  );
  const themePreference = useSettingsStore((state) => state.themePreference);
  const setThemePreference = useSettingsStore(
    (state) => state.setThemePreference
  );
  const deleteAllChats = useChatStore((state) => state.deleteAllChats);
  const { vectorStore } = useVectorStore();
  const { confirm, ConfirmElement } = useConfirm();
  const importChat = useImportChat();

  const handleDeleteAllChats = useCallback(async () => {
    const confirmed = await confirm({
      title: 'Delete all chats?',
      message: 'This permanently removes every chat and its messages.',
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;

    try {
      const llm = useLLMStore.getState();
      llm.interrupt();
      await llm.setActiveChatId(null);
      await deleteAllChats(vectorStore ?? undefined);
      Feedback.destructive();
      Toast.show({ type: 'defaultToast', text1: 'All chats deleted' });
      router.replace('/');
    } catch (error) {
      console.error('Error deleting all chats:', error);
      Alert.alert('Error', 'Failed to delete chats. Please try again.');
    }
  }, [confirm, deleteAllChats, vectorStore]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection title="Personalization">
          <SettingsRow
            label="Custom instructions"
            icon={<EditIcon width={20} height={20} style={styles.rowIcon} />}
            onPress={() => navigation.push('/custom-system-prompt')}
          />
        </SettingsSection>
        <SettingsSection title="Appearance">
          <SettingsChoiceRow
            label="Theme"
            options={THEME_OPTIONS}
            value={themePreference}
            onValueChange={setThemePreference}
          />
        </SettingsSection>
        <SettingsSection title="Chat">
          <SettingsToggleRow
            label="Response speed stats"
            description="Show time to first token and tokens per second under each answer."
            icon={
              <BenchmarkIcon width={20} height={20} style={styles.rowIcon} />
            }
            value={showPerformanceMetrics}
            onValueChange={setShowPerformanceMetrics}
          />
        </SettingsSection>
        <SettingsSection title="Data controls">
          <SettingsRow
            label="Import chat"
            icon={
              <DownloadIcon width={20} height={20} style={styles.rowIcon} />
            }
            onPress={importChat}
          />
          <SettingsRow
            label="Delete all chats"
            icon={
              <TrashIcon
                width={20}
                height={20}
                style={styles.destructiveIcon}
              />
            }
            onPress={handleDeleteAllChats}
            destructive
          />
        </SettingsSection>
        <SettingsSection title="About">
          <SettingsRow
            label="App info"
            icon={
              <InfoCircleIcon width={20} height={20} style={styles.rowIcon} />
            }
            onPress={() => navigation.push('/app-info')}
          />
        </SettingsSection>
      </ScrollView>
      {ConfirmElement}
    </View>
  );
};

export default SettingsScreen;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
      paddingTop: 16,
    },
    scrollContent: {
      gap: 24,
      paddingHorizontal: 16,
      paddingBottom: theme.insets.bottom + 16,
    },
    rowIcon: {
      color: theme.text.primary,
    },
    destructiveIcon: {
      color: theme.text.error,
    },
  });
