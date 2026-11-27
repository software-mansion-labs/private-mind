import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScrollView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import GlassScreenHeader, {
  useGlassScreenHeaderHeight,
} from '../../../components/GlassScreenHeader';
import PrimaryButton from '../../../components/PrimaryButton';
import { CustomKeyboardAvoidingView } from '../../../components/CustomKeyboardAvoidingView';
import { fontSizes, fontFamily, lineHeights } from '../../../styles/fontStyles';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { TEXT_SELECTION, Theme } from '../../../styles/colors';
import { useSettingsStore } from '../../../store/settingsStore';
import { Feedback } from '../../../utils/Feedback';
import { MAX_CUSTOM_SYSTEM_PROMPT_LENGTH } from '../../../constants/settings';
import { radius, space, stroke } from '../../../constants/design-system';

const INPUT_MIN_HEIGHT = 160;

export default function CustomSystemPromptScreen() {
  const router = useRouter();
  const headerHeight = useGlassScreenHeaderHeight(true);
  const { styles, theme } = useThemedStyles(createStyles, headerHeight);

  const customSystemPrompt = useSettingsStore((s) => s.customSystemPrompt);
  const setCustomSystemPrompt = useSettingsStore(
    (s) => s.setCustomSystemPrompt
  );
  const hasHydrated = useSettingsStore((s) => s.hasHydrated);

  const [draft, setDraft] = useState(customSystemPrompt);
  const [didSeed, setDidSeed] = useState(false);
  const [focused, setFocused] = useState(false);

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
            <View
              style={[
                styles.inputCard,
                focused && styles.inputCardFocused,
                isOverLimit && styles.inputCardError,
              ]}
            >
              <TextInput
                {...TEXT_SELECTION}
                value={draft}
                onChangeText={setDraft}
                editable={didSeed}
                multiline
                textAlignVertical="top"
                placeholder="e.g. Be concise and explain your reasoning. Avoid jargon."
                placeholderTextColor={theme.text.defaultTertiary}
                accessibilityLabel="Custom instructions"
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={styles.input}
                testID="custom-instructions-input"
              />
            </View>
            <View style={styles.footer}>
              {isOverLimit && (
                <Text style={styles.error}>
                  That&apos;s a bit too long — please shorten it.
                </Text>
              )}
              <Text style={[styles.counter, isOverLimit && styles.error]}>
                {trimmedDraft.length}/{MAX_CUSTOM_SYSTEM_PROMPT_LENGTH}
              </Text>
            </View>
          </View>
          <PrimaryButton text="Save" onPress={handleSave} disabled={!canSave} />
        </ScrollView>
      </View>
      <GlassScreenHeader
        title="Custom instructions"
        onBack={() => router.back()}
        sheet
      />
    </CustomKeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme, headerHeight: number) =>
  StyleSheet.create({
    keyboardAvoidingView: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    container: {
      flex: 1,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.four,
    },
    scrollView: {
      flex: 1,
    },
    scrollViewContent: {
      gap: space.six,
      paddingTop: headerHeight + space.six,
      paddingBottom: space.six,
    },
    section: {
      gap: space.two,
    },
    inputCard: {
      borderRadius: radius.twenty,
      borderWidth: stroke.soft,
      borderColor: theme.border.group,
      backgroundColor: theme.bg.group,
      paddingHorizontal: space.four,
      paddingVertical: space.three,
    },
    inputCardFocused: {
      borderColor: theme.text.accent,
    },
    inputCardError: {
      borderColor: theme.text.error,
    },
    input: {
      minHeight: INPUT_MIN_HEIGHT,
      padding: 0,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
    labelGroup: {
      gap: space.one,
      paddingHorizontal: space.one,
      marginBottom: space.two,
    },
    label: {
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    description: {
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
    footer: {
      flexDirection: 'row',
      gap: space.two,
      paddingHorizontal: space.one,
    },
    counter: {
      marginLeft: 'auto',
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
    error: {
      flexShrink: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.error,
    },
  });
