import React, { useState } from 'react';
import {
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useModelStore } from '../../../store/modelStore';
import { Model } from '../../../database/modelRepository';
import ModalHeader from '../../../components/ModalHeader';
import TextFieldInput from '../../../components/TextFieldInput';
import { fontSizes, fontFamily } from '../../../styles/fontFamily';
import { useTheme } from '../../../context/ThemeContext';
import PrimaryButton from '../../../components/PrimaryButton';
import { ScrollView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { InfoAlert } from '../../../components/InfoAlert';

export default function EditRemoteModelScreen() {
  const { modelId } = useLocalSearchParams<{ modelId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { getModelById, editModel } = useModelStore();
  const model = getModelById(modelId);

  const [modelName, setModelName] = useState(model?.id || '');
  const [localModelPath, setLocalModelPath] = useState<string>(
    model?.modelPath || ''
  );
  const [localTokenizerPath, setLocalTokenizerPath] = useState<string>(
    model?.tokenizerPath || ''
  );
  const [localTokenizerConfigPath, setLocalTokenizerConfigPath] =
    useState<string>(model?.tokenizerConfigPath || '');

  const handleSave = async () => {
    if (!localModelPath || !localTokenizerPath || !localTokenizerConfigPath) {
      Alert.alert('Missing Fields', 'Please select all necessary files.');
      return;
    }

    await editModel(
      modelId,
      localTokenizerPath,
      localTokenizerConfigPath,
      modelName || modelId
    );

    Toast.show({
      type: 'defaultToast',
      text1: `${modelName} has been successfully updated`,
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
        <ModalHeader title="Edit Local Model" onClose={() => router.back()} />
        <ScrollView contentContainerStyle={{ gap: 24, paddingBottom: 24 }}>
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
            <TextFieldInput
              editable={false}
              value={localModelPath}
              multiline={true}
              onChangeText={setLocalModelPath}
              placeholder="Enter external model URL"
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
            <TextFieldInput
              value={localTokenizerPath}
              multiline={true}
              onChangeText={setLocalTokenizerPath}
              placeholder="Enter external tokenizer URL"
            />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={{ ...styles.label, color: theme.text.primary }}>
              Tokenizer Config URL
            </Text>
            <TextFieldInput
              value={localTokenizerConfigPath}
              multiline={true}
              onChangeText={setLocalTokenizerConfigPath}
              placeholder="Enter external config URL"
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
