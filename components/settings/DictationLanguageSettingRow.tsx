import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import SoundwaveIcon from '../../assets/icons/soundwave.svg';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useSettingsStore } from '../../store/settingsStore';
import { Theme } from '../../styles/colors';
import { dictationPreferenceLabel } from '../../utils/dictationLanguage';
import { DICTATION_LANGUAGE_LABEL } from '../../constants/dictation-languages';
import { SettingsRow } from './SettingsRow';

const ICON_SIZE = 20;

export const DictationLanguageSettingRow = () => {
  const { styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const preference = useSettingsStore((state) => state.dictationLanguage);
  const value = dictationPreferenceLabel(preference);

  const handlePress = () => router.push('/settings/dictation-language');

  return (
    <SettingsRow
      label={DICTATION_LANGUAGE_LABEL}
      accessibilityLabel={`${DICTATION_LANGUAGE_LABEL}, ${value}`}
      icon={
        <SoundwaveIcon
          width={ICON_SIZE}
          height={ICON_SIZE}
          style={styles.icon}
        />
      }
      value={value}
      valueTestID="settings-dictation-language-value"
      showChevron
      onPress={handlePress}
      testID="settings-dictation-language"
    />
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    icon: {
      color: theme.text.primary,
    },
  });
