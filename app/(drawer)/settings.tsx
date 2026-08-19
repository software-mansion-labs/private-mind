import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import useDefaultHeader from '../../hooks/useDefaultHeader';
import { SettingsRow } from '../../components/settings/SettingsRow';
import { SettingsSection } from '../../components/settings/SettingsSection';
import { SettingsToggleRow } from '../../components/settings/SettingsToggleRow';
import EditIcon from '../../assets/icons/edit.svg';
import InfoCircleIcon from '../../assets/icons/info-circle.svg';
import BenchmarkIcon from '../../assets/icons/benchmark.svg';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useSettingsStore } from '../../store/settingsStore';
import { Theme } from '../../styles/colors';

const SettingsScreen = () => {
  useDefaultHeader();
  const router = useRouter();
  const { styles } = useThemedStyles(createStyles);
  const showPerformanceMetrics = useSettingsStore(
    (state) => state.showPerformanceMetrics
  );
  const setShowPerformanceMetrics = useSettingsStore(
    (state) => state.setShowPerformanceMetrics
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsSection title="Chat">
          <SettingsRow
            label="Personal preferences"
            icon={<EditIcon width={20} height={20} style={styles.rowIcon} />}
            onPress={() => router.push('/custom-system-prompt')}
          />
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
        <SettingsSection title="App">
          <SettingsRow
            label="App info"
            icon={
              <InfoCircleIcon width={20} height={20} style={styles.rowIcon} />
            }
            onPress={() => router.push('/app-info')}
          />
        </SettingsSection>
      </ScrollView>
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
  });
