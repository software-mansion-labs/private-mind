import React, { useCallback } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { router, useRouter } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import Toast from 'react-native-toast-message';
import useDefaultHeader from '../../hooks/useDefaultHeader';
import { SettingsRow } from '../../components/settings/SettingsRow';
import { SettingsGroup } from '../../components/settings/SettingsGroup';
import { SettingsToggleRow } from '../../components/settings/SettingsToggleRow';
import { SettingsChoiceRow } from '../../components/settings/SettingsChoiceRow';
import { ContextSizeSettingRow } from '../../components/settings/ContextSizeSettingRow';
import { GlassScrollEdge } from '../../components/chat-screen/GlassScrollEdge';
import EditIcon from '../../assets/icons/edit.svg';
import InfoCircleIcon from '../../assets/icons/info-circle.svg';
import BenchmarkIcon from '../../assets/icons/benchmark.svg';
import DownloadIcon from '../../assets/icons/download.svg';
import TrashIcon from '../../assets/icons/trash.svg';
import ShareIcon from '../../assets/icons/upload.svg';
import BookIcon from '../../assets/icons/book-open.svg';
import StarIcon from '../../assets/icons/star.svg';
import ChatIcon from '../../assets/icons/chat.svg';
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
import { shareApp } from '../../utils/shareApp';
import { openFeedback } from '../../utils/feedbackLink';
import { rateApp } from '../../utils/rateApp';
import { Theme } from '../../styles/colors';
import { space } from '../../constants/design-system';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const SettingsScreen = () => {
  useDefaultHeader({ glass: true });
  const navigation = useRouter();
  const headerHeight = useHeaderHeight();
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
    navigation.push('/custom-system-prompt');
  const handleOpenAppInfo = () => navigation.push('/app-info');
  const handleOpenMyPrivateMind = () => navigation.push('/my-private-mind');

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
        <SettingsGroup title="Chat">
          <SettingsRow
            label="Custom instructions"
            icon={<EditIcon width={20} height={20} style={styles.rowIcon} />}
            onPress={handleOpenCustomInstructions}
            showChevron
          />
          <ContextSizeSettingRow />
          <SettingsToggleRow
            label="Response speed stats"
            description="Show what each answer cost: document and web retrieval, time to first token, tokens per second."
            icon={
              <BenchmarkIcon width={20} height={20} style={styles.rowIcon} />
            }
            value={showPerformanceMetrics}
            onValueChange={setShowPerformanceMetrics}
          />
        </SettingsGroup>
        <SettingsGroup title="Appearance">
          <SettingsChoiceRow
            label="Theme"
            options={THEME_OPTIONS}
            value={themePreference}
            onValueChange={setThemePreference}
          />
          <SettingsToggleRow
            label="Haptic feedback"
            value={hapticsEnabled}
            onValueChange={handleHapticsChange}
          />
        </SettingsGroup>
        <SettingsGroup title="Data controls">
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
        <SettingsGroup title="Help us grow">
          <SettingsRow
            label="Share my Private Mind"
            icon={<BookIcon width={20} height={20} style={styles.rowIcon} />}
            onPress={handleOpenMyPrivateMind}
            showChevron
          />
          <SettingsRow
            label="Rate the app"
            icon={<StarIcon width={20} height={20} style={styles.rowIcon} />}
            onPress={rateApp}
          />
          <SettingsRow
            label="Share the app"
            icon={<ShareIcon width={20} height={20} style={styles.rowIcon} />}
            onPress={shareApp}
          />
          <SettingsRow
            label="Send feedback"
            icon={<ChatIcon width={20} height={20} style={styles.rowIcon} />}
            onPress={openFeedback}
          />
        </SettingsGroup>
        <SettingsGroup title="About">
          <SettingsRow
            label="App info"
            icon={
              <InfoCircleIcon width={20} height={20} style={styles.rowIcon} />
            }
            onPress={handleOpenAppInfo}
            showChevron
          />
        </SettingsGroup>
      </ScrollView>
      <GlassScrollEdge anchor={headerHeight} />
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
      paddingTop: headerHeight + 24,
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
