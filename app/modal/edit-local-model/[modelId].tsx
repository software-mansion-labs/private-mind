import React, { useMemo, useState } from 'react';
import { Text, StyleSheet, View, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useModelStore } from '../../../store/modelStore';
import ModalHeader from '../../../components/ModalHeader';
import { fontSizes, fontFamily } from '../../../styles/fontStyles';
import { useTheme } from '../../../context/ThemeContext';
import PrimaryButton from '../../../components/PrimaryButton';
import { ScrollView } from 'react-native-gesture-handler';
import UploadInput from '../../../components/UploadInput';
import { InfoAlert } from '../../../components/InfoAlert';
import TextFieldInput from '../../../components/TextFieldInput';
import Toast from 'react-native-toast-message';
import { Theme } from '../../../styles/colors';
import { LocalModelFormState } from '../add-local-model';
import { CustomKeyboardAvoidingView } from '../../../components/CustomKeyboardAvoidingView';

type LocalFile = {
  name: string;
  size: number | null;
  uri: string;
};

interface EditModelFormState extends LocalModelFormState {
  modelName: string;
}

const parsePathToLocalFile = (path?: string): LocalFile | null => {
  if (!path) return null;
  return {
    name: path.split('/').pop() || '',
    size: null,
    uri: path.replace('file://', ''),
  };
};

export default function EditLocalModelScreen() {
  const { modelId: rawModelId } = useLocalSearchParams<{ modelId: string }>();
  const modelId = parseInt(rawModelId);

  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { getModelById, editModel } = useModelStore();
  const model = getModelById(modelId);

  const [
    { modelName, localModelPath, localTokenizerPath, localTokenizerConfigPath },
    setFormState,
  ] = useState<EditModelFormState>({
    modelName: model?.modelName || '',
    localModelPath: parsePathToLocalFile(model?.modelPath),
    localTokenizerPath: parsePathToLocalFile(model?.tokenizerPath),
    localTokenizerConfigPath: parsePathToLocalFile(model?.tokenizerConfigPath),
  });

  const setFormField = <K extends keyof EditModelFormState>(
    field: K,
    value: EditModelFormState[K]
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
    <CustomKeyboardAvoidingView
      isModalScreen
      style={styles.keyboardAvoidingView}
    >
      <View style={styles.container}>
        <ModalHeader title="Edit Local Model" onClose={() => router.back()} />
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.textFieldSection}>
            <Text style={styles.label}>Model Name</Text>
            <TextFieldInput
              value={modelName}
              onChangeText={(text) => setFormField('modelName', text)}
            />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={styles.label}>Model URL</Text>
            <UploadInput
              fileInfo={localModelPath}
              onChange={(file) => setFormField('localModelPath', file)}
              disabled
            />
            <InfoAlert text="Model file is permanently linked to this model and cannot be changed" />
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
        <PrimaryButton text="Save changes" onPress={handleSave} />
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
      paddingBottom: theme.insets.bottom + 16,
      justifyContent: 'space-between',
    },
    scrollViewContent: {
      gap: 24,
      paddingBottom: 24,
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
