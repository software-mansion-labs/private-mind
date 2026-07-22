import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Text, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import ModalHeader from '../../components/ModalHeader';
import PrimaryButton from '../../components/PrimaryButton';
import TextAreaField from '../../components/TextAreaField';
import { CustomKeyboardAvoidingView } from '../../components/CustomKeyboardAvoidingView';
import { fontSizes, fontFamily } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { useSettingsStore } from '../../store/settingsStore';
import { Feedback } from '../../utils/Feedback';
import { MAX_CUSTOM_SYSTEM_PROMPT_LENGTH } from '../../constants/settings';

export default function CustomSystemPromptScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const customSystemPrompt = useSettingsStore((s) => s.customSystemPrompt);
  const setCustomSystemPrompt = useSettingsStore(
    (s) => s.setCustomSystemPrompt
  );
  const hasHydrated = useSettingsStore((s) => s.hasHydrated);

  const [draft, setDraft] = useState(customSystemPrompt);
  const [didSeed, setDidSeed] = useState(false);

  useEffect(() => {
    if (hasHydrated && !didSeed) {
      setDraft(customSystemPrompt);
      setDidSeed(true);
    }
  }, [hasHydrated, didSeed, customSystemPrompt]);

  const trimmedDraft = draft.trim();
  const isOverLimit = trimmedDraft.length > MAX_CUSTOM_SYSTEM_PROMPT_LENGTH;
  const isDirty = trimmedDraft !== customSystemPrompt;
  const canSave = didSeed && isDirty && !isOverLimit;

  const handleSave = () => {
    if (!canSave) return;
    setCustomSystemPrompt(trimmedDraft);
    Feedback.editSave();
    Toast.show({
      type: 'defaultToast',
      text1: 'Preferences saved',
    });
    router.back();
  };

  return (
    <CustomKeyboardAvoidingView
      isModalScreen
      style={styles.keyboardAvoidingView}
    >
      <View style={styles.container}>
        <ModalHeader
          title="Personal preferences"
          leftIcon="back"
          onClose={() => router.back()}
        />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <View style={styles.labelGroup}>
              <Text style={styles.label}>
                How would you like Private Mind to respond?
              </Text>
              <Text style={styles.description}>
                These preferences shape every conversation.
              </Text>
            </View>
            <TextAreaField
              value={draft}
              onChangeText={setDraft}
              editable={didSeed}
              errorMessage={
                isOverLimit
                  ? "That's a bit too long — please shorten it."
                  : undefined
              }
              placeholder="e.g. Be concise and explain your reasoning. Avoid jargon."
            />
            <PrimaryButton
              text="Save preferences"
              onPress={handleSave}
              disabled={!canSave}
            />
          </View>
        </ScrollView>
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    keyboardAvoidingView: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    container: {
      flex: 1,
      padding: 16,
      paddingTop: Platform.OS === 'ios' ? theme.insets.top : 16,
      paddingBottom: theme.insets.bottom + 16,
    },
    scrollView: {
      flex: 1,
    },
    scrollViewContent: {
      gap: 24,
      paddingBottom: 24,
    },
    section: {
      gap: 16,
    },
    labelGroup: {
      gap: 4,
    },
    label: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    description: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
  });
