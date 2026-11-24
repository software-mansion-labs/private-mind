import React from 'react';
import { useRouter } from 'expo-router';
import { CONVERSATION_MEMORY_LABEL } from '../../constants/conversation-memory-copy';
import ProcessorIcon from '../../assets/icons/processor.svg';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { StyleSheet } from 'react-native';
import { Theme } from '../../styles/colors';
import { useContextSizeLabel } from './ContextSizeSelector';
import { SettingsRow } from './SettingsRow';

const ICON_SIZE = 20;

export const ContextSizeSettingRow = () => {
  const { styles } = useThemedStyles(createStyles);
  const router = useRouter();
  const value = useContextSizeLabel();

  const handlePress = () => router.push('/context-size');

  return (
    <SettingsRow
      label={CONVERSATION_MEMORY_LABEL}
      accessibilityLabel={`${CONVERSATION_MEMORY_LABEL}, ${value}`}
      icon={
        <ProcessorIcon
          width={ICON_SIZE}
          height={ICON_SIZE}
          style={styles.icon}
        />
      }
      value={value}
      valueTestID="settings-context-size-value"
      showChevron
      onPress={handlePress}
      testID="settings-context-size"
    />
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    icon: {
      color: theme.text.primary,
    },
  });
