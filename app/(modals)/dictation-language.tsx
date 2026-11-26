import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native-gesture-handler';
import GlassScreenHeader, {
  useGlassScreenHeaderHeight,
} from '../../components/GlassScreenHeader';
import { DictationLanguageSelector } from '../../components/settings/DictationLanguageSelector';
import { DictationModelList } from '../../components/settings/DictationModelList';
import { DICTATION_LANGUAGE_LABEL } from '../../constants/dictation-languages';
import { space } from '../../constants/design-system';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';

export default function DictationLanguageScreen() {
  const router = useRouter();
  const headerHeight = useGlassScreenHeaderHeight();
  const { styles } = useThemedStyles(createStyles, headerHeight);

  const handleBack = () => router.back();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <DictationModelList />
        <DictationLanguageSelector />
      </ScrollView>
      <GlassScreenHeader title={DICTATION_LANGUAGE_LABEL} onBack={handleBack} />
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
      gap: space.six,
      paddingTop: headerHeight + space.four,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.four,
    },
  });
