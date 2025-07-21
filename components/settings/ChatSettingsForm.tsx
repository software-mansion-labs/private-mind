import React, { RefObject } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import InfoCircleIcon from '../../assets/icons/info-circle.svg';
import TextFieldInput from '../TextFieldInput';
import { useTheme } from '../../context/ThemeContext';
import { Model } from '../../database/modelRepository';
import EntryButton from '../EntryButton';
import ModelCard from '../model-hub/ModelCard';
import SecondaryButton from '../SecondaryButton';
import TextAreaField from '../TextAreaField';

interface Props {
  settings: { title: string; contextWindow: string; systemPrompt: string };
  setSetting: (
    key: 'title' | 'contextWindow' | 'systemPrompt',
    value: string
  ) => void;
  model?: Model;
  isDefaultSettings: boolean;
  scrollViewRef: RefObject<ScrollView>;
  onDelete: () => void;
  onExport: () => void;
  onAppInfo: () => void;
}

const ChatSettingsForm = ({
  settings,
  setSetting,
  model,
  isDefaultSettings,
  scrollViewRef,
  onDelete,
  onExport,
  onAppInfo,
}: Props) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const scrollToInput = async () => {
    if (Platform.OS === 'ios') {
      await new Promise((resolve) => setTimeout(resolve, 25));
      scrollViewRef.current?.scrollTo({ y: 500, animated: true });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollViewContent}
      showsVerticalScrollIndicator={false}
      ref={scrollViewRef}
    >
      {!isDefaultSettings && (
        <View style={styles.textFieldSection}>
          <Text style={styles.label}>Chat name</Text>
          <TextFieldInput
            value={settings.title}
            maxLength={25}
            onChangeText={(val) => setSetting('title', val)}
          />
        </View>
      )}

      {model && (
        <View style={styles.textFieldSection}>
          <Text style={styles.label}>Model in use</Text>
          <Text style={styles.subLabel}>
            Model selected during the creation of the chatroom. It cannot be
            changed.
          </Text>
          <ModelCard model={model} onPress={() => {}} />
        </View>
      )}

      <View style={styles.textFieldSection}>
        <Text style={styles.label}>Context Window</Text>
        <Text style={styles.subLabel}>
          Number of previously entered messages the model will have access to.
        </Text>
        <TextFieldInput
          value={settings.contextWindow}
          onChangeText={(val) => setSetting('contextWindow', val)}
          keyboardType="number-pad"
          placeholder="ex. 6"
        />
      </View>

      <View style={styles.textFieldSection}>
        <Text style={styles.label}>System Prompt</Text>
        <Text style={styles.subLabel}>
          Instruction defining the behavior of the model.
        </Text>
        <TextAreaField
          value={settings.systemPrompt}
          onChangeText={(val) => setSetting('systemPrompt', val)}
          placeholder="ex. Act as a IT support consultant and reply using only 1 sentence."
          placeholderTextColor={theme.text.defaultTertiary}
          onFocus={scrollToInput}
        />
      </View>

      <View style={styles.buttonSection}>
        {!isDefaultSettings && (
          <>
            <SecondaryButton text={'Export Chat'} onPress={onExport} />
            <SecondaryButton
              text={'Delete Chat'}
              style={{ borderColor: theme.bg.errorPrimary }}
              textStyle={{ color: theme.text.error }}
              onPress={onDelete}
            />
          </>
        )}
        <EntryButton
          text={'App Info'}
          onPress={onAppInfo}
          style={{ justifyContent: 'center' }}
          icon={
            <InfoCircleIcon
              width={20}
              height={20}
              style={{ color: theme.text.primary }}
            />
          }
        />
      </View>
    </ScrollView>
  );
};

export default ChatSettingsForm;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrollViewContent: {
      gap: 24,
      paddingBottom: 24,
    },
    textFieldSection: {
      gap: 16,
    },
    buttonSection: {
      gap: 12,
    },
    label: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    subLabel: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultSecondary,
    },
  });
