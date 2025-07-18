import React, { useMemo, useState } from 'react';
import {
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useModelStore } from '../../store/modelStore';
import ModalHeader from '../../components/ModalHeader';
import { fontSizes, fontFamily } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import PrimaryButton from '../../components/PrimaryButton';
import { ScrollView } from 'react-native-gesture-handler';
import UploadInput from '../../components/UploadInput';
import Toast from 'react-native-toast-message';
import { Theme } from '../../styles/colors';

type LocalFile = {
  name: string;
  size: number | null;
  uri: string;
};

export interface LocalModelFormState {
  localModelPath: LocalFile | null;
  localTokenizerPath: LocalFile | null;
  localTokenizerConfigPath: LocalFile | null;
}

export default function AddLocalModelScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { addModelToDB } = useModelStore();

  const [
    { localModelPath, localTokenizerPath, localTokenizerConfigPath },
    setFormState,
  ] = useState<LocalModelFormState>({
    localModelPath: null,
    localTokenizerPath: null,
    localTokenizerConfigPath: null,
  });

  const setFormField = <K extends keyof LocalModelFormState>(
    field: K,
    value: LocalModelFormState[K]
  ) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!localModelPath || !localTokenizerPath || !localTokenizerConfigPath) {
      Alert.alert('Missing Fields', 'Please select all necessary files.');
      return;
    }
    const modelName = localModelPath.name.split('.')[0];
    await addModelToDB({
      modelName,
      isDownloaded: true,
      source: 'local',
      modelPath: `file://${localModelPath.uri}`,
      tokenizerPath: `file://${localTokenizerPath.uri}`,
      tokenizerConfigPath: `file://${localTokenizerConfigPath.uri}`,
      modelSize: localModelPath.size! / 1024 / 1024 / 1024,
    });
    Toast.show({
      type: 'defaultToast',
      text1: `${modelName} has been successfully added`,
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <View style={styles.container}>
        <ModalHeader title="Add Local Model" onClose={() => router.back()} />
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.description}>
            Add a model using an existing files in your phone storage.
          </Text>
          <View style={styles.textFieldSection}>
            <Text style={styles.label}>Model URL</Text>
            <UploadInput
              fileInfo={localModelPath}
              onChange={(file) => setFormField('localModelPath', file)}
            />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={styles.label}>Tokenizer URL</Text>
            <UploadInput
              fileInfo={localTokenizerPath}
              onChange={(file) => setFormField('localTokenizerPath', file)}
            />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={styles.label}>Tokenizer Config URL</Text>
            <UploadInput
              fileInfo={localTokenizerConfigPath}
              onChange={(file) =>
                setFormField('localTokenizerConfigPath', file)
              }
            />
          </View>
        </ScrollView>
        <PrimaryButton text="Add model" onPress={handleSave} />
      </View>
    </KeyboardAvoidingView>
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
      paddingBottom: Platform.OS === 'ios' ? 24 : 0,
      justifyContent: 'space-between',
    },
    scrollViewContent: {
      gap: 24,
      paddingBottom: 24,
    },
    description: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    textFieldSection: {
      gap: 16,
    },
    label: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
  });
