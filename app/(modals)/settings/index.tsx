import React, { useCallback } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { router, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { SettingsRow } from '../../../components/settings/SettingsRow';
import { SettingsGroup } from '../../../components/settings/SettingsGroup';
import { SettingsToggleRow } from '../../../components/settings/SettingsToggleRow';
import { ThemePicker } from '../../../components/settings/ThemePicker';
import { ContextSizeSettingRow } from '../../../components/settings/ContextSizeSettingRow';
import GlassScreenHeader, {
  useGlassScreenHeaderHeight,
} from '../../../components/GlassScreenHeader';
import EditIcon from '../../../assets/icons/edit.svg';
import InfoCircleIcon from '../../../assets/icons/info-circle.svg';
import BenchmarkIcon from '../../../assets/icons/benchmark.svg';
import DownloadIcon from '../../../assets/icons/download.svg';
import TrashIcon from '../../../assets/icons/trash.svg';
import PhoneIcon from '../../../assets/icons/phone.svg';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { useConfirm } from '../../../hooks/useConfirm';
import { useImportChat } from '../../../hooks/useImportChat';
import { useVectorStore } from '../../../context/VectorStoreContext';
import { useChatStore } from '../../../store/chatStore';
import { useLLMStore } from '../../../store/llmStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { Feedback } from '../../../utils/Feedback';
import { currentAppVersion } from '../../../utils/appVersion';
import { Theme } from '../../../styles/colors';
import { space } from '../../../constants/design-system';

const SettingsScreen = () => {
  const navigation = useRouter();
  const headerHeight = useGlassScreenHeaderHeight(true);
  const { styles } = useThemedStyles(createStyles, headerHeight);
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
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = useSettingsStore(
    (state) => state.setHapticsEnabled
  );
  const hasCustomInstructions = useSettingsStore(
    (state) => state.customSystemPrompt.length > 0
  );
  const deleteAllChats = useChatStore((state) => state.deleteAllChats);
  const { vectorStore } = useVectorStore();
  const { confirm, ConfirmElement } = useConfirm();
  const importChat = useImportChat();

  const handleHapticsChange = useCallback(
    (enabled: boolean) => {
      setHapticsEnabled(enabled);
      if (enabled) Feedback.toggleOn();
    },
    [setHapticsEnabled]
  );

  const handleOpenCustomInstructions = () =>
    navigation.push('/settings/custom-system-prompt');
  const handleOpenAppInfo = () => navigation.push('/settings/app-info');

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
      router.dismissTo('/');
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
        <SettingsGroup title="General">
          <ThemePicker
            value={themePreference}
            onValueChange={setThemePreference}
          />
          <SettingsToggleRow
            label="Haptic feedback"
            icon={<PhoneIcon width={20} height={20} style={styles.rowIcon} />}
            value={hapticsEnabled}
            onValueChange={handleHapticsChange}
            testID="settings-haptics-switch"
          />
        </SettingsGroup>
        <SettingsGroup title="Chat">
          <SettingsRow
            label="Custom instructions"
            icon={<EditIcon width={20} height={20} style={styles.rowIcon} />}
            value={hasCustomInstructions ? 'On' : 'Off'}
            valueTestID="settings-custom-instructions-value"
            onPress={handleOpenCustomInstructions}
            showChevron
          />
          <ContextSizeSettingRow />
          <SettingsToggleRow
            label="Response speed stats"
            description="Show retrieval time, time to first token and tokens per second under each answer."
            icon={
              <BenchmarkIcon width={20} height={20} style={styles.rowIcon} />
            }
            value={showPerformanceMetrics}
            onValueChange={setShowPerformanceMetrics}
            testID="settings-speed-stats-switch"
          />
        </SettingsGroup>
        <SettingsGroup title="Data">
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
        </SettingsGroup>
        <SettingsGroup title="About">
          <SettingsRow
            label="App info"
            icon={
              <InfoCircleIcon width={20} height={20} style={styles.rowIcon} />
            }
            value={`v${currentAppVersion()}`}
            onPress={handleOpenAppInfo}
            showChevron
          />
        </SettingsGroup>
      </ScrollView>
      <GlassScreenHeader
        title="Settings"
        icon="close"
        onBack={() => navigation.back()}
        sheet
      />
      {ConfirmElement}
    </View>
  );
};

export default SettingsScreen;

const createStyles = (theme: Theme, headerHeight: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    scrollContent: {
      gap: space.six,
      paddingTop: headerHeight + space.six,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + 16,
    },
    rowIcon: {
      color: theme.text.primary,
    },
    destructiveIcon: {
      color: theme.text.error,
    },
  });
