import React, { useState } from 'react';
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
import { Model } from '../../database/modelRepository';
import ModalHeader from '../../components/ModalHeader';
import { fontSizes, fontFamily } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import PrimaryButton from '../../components/PrimaryButton';
import { ScrollView } from 'react-native-gesture-handler';
import UploadInput from '../../components/UploadInput';
import Toast from 'react-native-toast-message';

type LocalFile = {
  name: string;
  size: number | null;
  uri: string;
};

export default function AddLocalModelScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { addModelToDB } = useModelStore();

  const [localModelPath, setLocalModelPath] = useState<LocalFile | null>(null);
  const [localTokenizerPath, setLocalTokenizerPath] =
    useState<LocalFile | null>(null);
  const [localTokenizerConfigPath, setLocalTokenizerConfigPath] =
    useState<LocalFile | null>(null);

  const handleSave = async () => {
    if (!localModelPath || !localTokenizerPath || !localTokenizerConfigPath) {
      Alert.alert('Missing Fields', 'Please select all necessary files.');
      return;
    }

    const id = `model-${Date.now()}`;
    const model: Model = {
      id,
      isDownloaded: 1,
      source: 'local',
      modelPath: `file://${localModelPath.uri}`,
      tokenizerPath: `file://${localTokenizerPath.uri}`,
      tokenizerConfigPath: `file://${localTokenizerConfigPath.uri}`,
    };
    await addModelToDB(model);
    Toast.show({
      type: 'defaultToast',
      text1: `${model.id} has been succesfully added`,
      props: { backgroundColor: theme.bg.strongPrimary },
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <View style={styles.container}>
        <ModalHeader title="Add Local Model" onClose={() => router.back()} />
        <ScrollView contentContainerStyle={{ gap: 24 }}>
          <Text style={{ ...styles.description, color: theme.text.primary }}>
            Add a model using an existing files in your phone storage.
          </Text>
          <View style={styles.textFieldSection}>
            <Text style={{ ...styles.label, color: theme.text.primary }}>
              Model URL
            </Text>
            <UploadInput
              fileInfo={localModelPath}
              onChange={setLocalModelPath}
            />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={{ ...styles.label, color: theme.text.primary }}>
              Tokenizer URL
            </Text>
            <UploadInput
              fileInfo={localTokenizerPath}
              onChange={setLocalTokenizerPath}
            />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={{ ...styles.label, color: theme.text.primary }}>
              Tokenizer Config URL
            </Text>
            <UploadInput
              fileInfo={localTokenizerConfigPath}
              onChange={setLocalTokenizerConfigPath}
            />
          </View>
        </ScrollView>
        <PrimaryButton text="Add model" onPress={handleSave} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  description: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.md,
  },
  textFieldSection: {
    gap: 16,
  },
  label: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.medium,
  },
  subLabel: { fontFamily: fontFamily.regular, fontSize: fontSizes.sm },
});
