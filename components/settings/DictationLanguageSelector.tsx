import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useSettingsStore } from '../../store/settingsStore';
import {
  DICTATION_LANGUAGE_LABEL,
  dictationLanguageName,
  filterDictationLanguages,
} from '../../constants/dictation-languages';
import {
  type DictationLanguagePreference,
  PHONE_LANGUAGE,
  phoneDictationLanguage,
} from '../../utils/dictationLanguage';
import { pickDictationLanguage } from '../../utils/chooseDictationLanguage';
import { whisperDownloadSizeLabel } from '../../utils/sttModelFiles';
import { Feedback } from '../../utils/Feedback';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { space } from '../../constants/design-system';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import SettingsRowGroup from './SettingsRowGroup';
import SectionHeader from '../model-hub/SectionHeader';
import SearchField from '../SearchField';
import CheckIcon from '../../assets/icons/check.svg';

const CHECK_SIZE = 20;
const LABEL_LINE_HEIGHT = lineHeights.sm;

interface LanguageChoice {
  value: DictationLanguagePreference;
  label: string;
  description?: string;
}

const modelNote = () =>
  `English uses the English speech model. Every other language uses the multilingual model, a one-time ${whisperDownloadSizeLabel('multilingual')} download.`;

export const DictationLanguageSelector = () => {
  const { styles } = useThemedStyles(createStyles);
  const chosen = useSettingsStore((state) => state.dictationLanguage);
  const [query, setQuery] = useState('');
  const phoneLanguage = useMemo(phoneDictationLanguage, []);
  const languages = useMemo(() => filterDictationLanguages(query), [query]);

  const phoneChoice: LanguageChoice = {
    value: PHONE_LANGUAGE,
    label: 'Phone language',
    description: dictationLanguageName(phoneLanguage),
  };
  const languageChoices: LanguageChoice[] = languages.map(({ code, name }) => ({
    value: code,
    label: name,
  }));
  const selectedIndex = languageChoices.findIndex(
    (choice) => choice.value === chosen
  );

  const handleSelect = async (next: DictationLanguagePreference) => {
    if (next === chosen) return;
    if (await pickDictationLanguage(next)) Feedback.toggleOn();
  };

  const renderChoice = (choice: LanguageChoice) => {
    const checked = choice.value === chosen;
    const handlePress = () => handleSelect(choice.value);
    return (
      <Pressable
        key={choice.value}
        onPress={handlePress}
        accessibilityRole="radio"
        accessibilityLabel={choice.label}
        accessibilityHint={choice.description}
        accessibilityState={{ checked }}
        testID={`dictation-language-${choice.value}`}
        style={({ pressed }) => [
          styles.option,
          checked && styles.optionChecked,
          pressed && pressedOpacity,
        ]}
      >
        <View style={styles.texts}>
          <Text
            style={[styles.optionLabel, checked && styles.optionLabelChecked]}
            maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
          >
            {choice.label}
          </Text>
          {choice.description ? (
            <Text
              style={styles.description}
              maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
            >
              {choice.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.checkSlot}>
          {checked && (
            <CheckIcon
              width={CHECK_SIZE}
              height={CHECK_SIZE}
              style={styles.check}
              testID={`dictation-language-${choice.value}-check`}
            />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={DICTATION_LANGUAGE_LABEL}
      style={styles.group}
      testID="dictation-language-group"
    >
      <Text style={styles.note} maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}>
        {modelNote()}
      </Text>
      <SettingsRowGroup separatorInset={0}>
        {renderChoice(phoneChoice)}
      </SettingsRowGroup>
      <View style={styles.section}>
        <SectionHeader title="Languages" />
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search languages"
          accessibilityLabel="Search languages"
          testID="dictation-language-search"
        />
        {languageChoices.length > 0 ? (
          <SettingsRowGroup
            separatorInset={0}
            selectedIndex={selectedIndex < 0 ? undefined : selectedIndex}
          >
            {languageChoices.map(renderChoice)}
          </SettingsRowGroup>
        ) : (
          <Text style={styles.note}>No language matches “{query}”.</Text>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    group: {
      gap: space.four,
    },
    section: {
      gap: space.two,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space.three,
      padding: space.four,
    },
    optionChecked: {
      backgroundColor: theme.bg.accentSoft,
    },
    check: {
      color: theme.text.accent,
    },
    checkSlot: {
      width: CHECK_SIZE,
      height: LABEL_LINE_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    texts: {
      flex: 1,
      gap: space.half,
    },
    optionLabel: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: LABEL_LINE_HEIGHT,
      color: theme.text.primary,
    },
    optionLabelChecked: {
      color: theme.text.accent,
    },
    description: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
    note: {
      paddingHorizontal: space.one,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
  });
