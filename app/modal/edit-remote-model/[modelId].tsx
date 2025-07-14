import React, { useMemo, useRef, useState } from 'react';
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
import ModalHeader from '../../../components/ModalHeader';
import TextFieldInput from '../../../components/TextFieldInput';
import { fontSizes, fontFamily } from '../../../styles/fontFamily';
import { useTheme } from '../../../context/ThemeContext';
import PrimaryButton from '../../../components/PrimaryButton';
import { ScrollView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { InfoAlert } from '../../../components/InfoAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme } from '../../../styles/colors';

export default function EditRemoteModelScreen() {
  const { modelId: rawModelId } = useLocalSearchParams<{ modelId: string }>();
  const modelId = parseInt(rawModelId);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { getModelById, editModel } = useModelStore();
  const model = getModelById(modelId);

  const [modelName, setModelName] = useState(model?.modelName || '');
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
      modelName
    );
    Toast.show({
      type: 'defaultToast',
      text1: `${modelName} has been successfully updated`,
    });
    router.back();
  };

  const scrollToBottom = async () => {
    if (Platform.OS === 'ios') {
      await new Promise((resolve) => setTimeout(resolve, 25));
      scrollViewRef.current?.scrollTo({ y: 500, animated: true });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 + insets.bottom : 0}
    >
      <View style={styles.container}>
        <ModalHeader title="Edit Remote Model" onClose={() => router.back()} />
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          ref={scrollViewRef}
        >
          <View style={styles.textFieldSection}>
            <Text style={styles.label}>Model Name</Text>
            <TextFieldInput value={modelName} onChangeText={setModelName} />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={styles.label}>Model URL</Text>
            <TextFieldInput
              editable={false}
              value={localModelPath}
              multiline={true}
              onChangeText={setLocalModelPath}
              placeholder="Enter external model URL"
            />
            <InfoAlert text="Model file is permanently linked to this model and cannot be changed" />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={styles.label}>Tokenizer URL</Text>
            <TextFieldInput
              value={localTokenizerPath}
              multiline={true}
              onChangeText={setLocalTokenizerPath}
              placeholder="Enter external tokenizer URL"
              onFocus={scrollToBottom}
            />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={styles.label}>Tokenizer Config URL</Text>
            <TextFieldInput
              value={localTokenizerConfigPath}
              multiline={true}
              onChangeText={setLocalTokenizerConfigPath}
              placeholder="Enter external config URL"
              onFocus={scrollToBottom}
            />
          </View>
        </ScrollView>
        <PrimaryButton text="Save changes" onPress={handleSave} />
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
      paddingBottom: Platform.OS === 'ios' ? 16 : 0,
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
