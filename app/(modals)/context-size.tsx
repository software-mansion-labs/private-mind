import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native-gesture-handler';
import GlassScreenHeader, {
  useGlassScreenHeaderHeight,
} from '../../components/GlassScreenHeader';
import { ContextSizeSelector } from '../../components/settings/ContextSizeSelector';
import { CONVERSATION_MEMORY_LABEL } from '../../constants/conversation-memory-copy';
import { space } from '../../constants/design-system';
import { useLastUsedModel } from '../../hooks/useLastUsedModel';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useLLMStore } from '../../store/llmStore';
import { useModelStore } from '../../store/modelStore';
import { Theme } from '../../styles/colors';

export default function ContextSizeScreen() {
  const router = useRouter();
  const headerHeight = useGlassScreenHeaderHeight();
  const { styles } = useThemedStyles(createStyles, headerHeight);
  const loadedModel = useLLMStore((state) => state.model);
  const lastUsedModel = useLastUsedModel();
  const firstDownloadedModel = useModelStore(
    (state) => state.downloadedModels[0] ?? null
  );
  const isResponding = useLLMStore(
    (state) => state.isGenerating || state.isProcessingPrompt
  );

  const handleBack = () => router.back();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ContextSizeSelector
          model={loadedModel ?? lastUsedModel ?? firstDownloadedModel}
          disabled={isResponding}
          label={CONVERSATION_MEMORY_LABEL}
        />
      </ScrollView>
      <GlassScreenHeader
        title={CONVERSATION_MEMORY_LABEL}
        onBack={handleBack}
      />
    </View>
  );
}

const createStyles = (theme: Theme, headerHeight: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    content: {
      paddingTop: headerHeight + space.four,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.four,
    },
  });
