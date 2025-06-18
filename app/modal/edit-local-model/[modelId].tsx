import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  View,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useModelStore } from '../../../store/modelStore';
import ModalHeader from '../../../components/ModalHeader';
import { fontSizes, fontFamily } from '../../../styles/fontFamily';
import { useTheme } from '../../../context/ThemeContext';
import PrimaryButton from '../../../components/PrimaryButton';
import { ScrollView } from 'react-native-gesture-handler';
import UploadInput from '../../../components/UploadInput';
import { InfoAlert } from '../../../components/InfoAlert';
import TextFieldInput from '../../../components/TextFieldInput';
import Toast from 'react-native-toast-message';

type LocalFile = {
  name: string;
  size: number | null;
  uri: string;
};

export default function EditLocalModelScreen() {
  const { modelId: rawModelId } = useLocalSearchParams<{ modelId: string }>();
  const modelId = parseInt(rawModelId);
  const router = useRouter();
  const { theme } = useTheme();
  const { getModelById, editModel } = useModelStore();
  const model = getModelById(modelId);

  const [modelName, setModelName] = useState(model?.modelName || '');
  const [localModelPath, setLocalModelPath] = useState<LocalFile | null>({
    name: model?.modelPath.split('/').pop() || '',
    size: null,
    uri: model?.modelPath.replace('file://', '') || '',
  });
  const [localTokenizerPath, setLocalTokenizerPath] =
    useState<LocalFile | null>({
      name: model?.tokenizerPath.split('/').pop() || '',
      size: null,
      uri: model?.tokenizerPath.replace('file://', '') || '',
    });
  const [localTokenizerConfigPath, setLocalTokenizerConfigPath] =
    useState<LocalFile | null>({
      name: model?.tokenizerConfigPath.split('/').pop() || '',
      size: null,
      uri: model?.tokenizerConfigPath.replace('file://', '') || '',
    });

  const handleSave = async () => {
    if (!localModelPath || !localTokenizerPath || !localTokenizerConfigPath) {
      Alert.alert('Missing Fields', 'Please select all necessary files.');
      return;
    }

    await editModel(
      modelId,
      localTokenizerPath.uri,
      localTokenizerConfigPath.uri,
      modelName
    );

    Toast.show({
      type: 'defaultToast',
      text1: `${modelName} has been successfully updated`,
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg.softPrimary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <View style={styles.container}>
        <ModalHeader title="Edit Local Model" onClose={() => router.back()} />
        <ScrollView
          contentContainerStyle={{ gap: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.textFieldSection}>
            <Text style={{ ...styles.label, color: theme.text.primary }}>
              Model Name
            </Text>
            <TextFieldInput value={modelName} onChangeText={setModelName} />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={{ ...styles.label, color: theme.text.primary }}>
              Model URL
            </Text>
            <UploadInput
              fileInfo={localModelPath}
              onChange={setLocalModelPath}
              disabled
            />
            <InfoAlert
              text={
                'Model file is permanently linked to this model and cannot be changed'
              }
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
        <PrimaryButton text="Save changes" onPress={handleSave} />
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
