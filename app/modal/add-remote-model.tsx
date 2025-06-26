import React, { useRef, useState } from 'react';
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
import TextFieldInput from '../../components/TextFieldInput';
import { fontSizes, fontFamily } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import PrimaryButton from '../../components/PrimaryButton';
import { ScrollView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddRemoteModelScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const { addModelToDB } = useModelStore();
  const insets = useSafeAreaInsets();
  const [remoteModelPath, setRemoteModelPath] = useState('');
  const [remoteTokenizerPath, setRemoteTokenizerPath] = useState('');
  const [remoteTokenizerConfigPath, setRemoteTokenizerConfigPath] =
    useState('');

  const handleSave = async () => {
    if (
      !remoteModelPath ||
      !remoteTokenizerPath ||
      !remoteTokenizerConfigPath
    ) {
      Alert.alert('Missing Fields', 'Please provide all necessary URLs.');
      return;
    }

    const modelName =
      remoteModelPath.split('/').pop()?.split('.')[0] || `model-${Date.now()}`;
    await addModelToDB({
      modelName,
      isDownloaded: false,
      source: 'remote',
      modelPath: remoteModelPath,
      tokenizerPath: remoteTokenizerPath,
      tokenizerConfigPath: remoteTokenizerConfigPath,
    });
    Toast.show({
      type: 'defaultToast',
      text1: `${modelName} has been successfully added`,
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
      style={{ flex: 1, backgroundColor: theme.bg.softPrimary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 + insets.bottom : 0}
    >
      <View style={styles.container}>
        <ModalHeader title="Add External Model" onClose={() => router.back()} />
        <ScrollView
          contentContainerStyle={{ gap: 24, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          ref={scrollViewRef}
        >
          <Text style={{ ...styles.description, color: theme.text.primary }}>
            Add a model from HuggingFace or other external sources. You'll need
            the model and tokenizer URLs.
          </Text>
          <View style={styles.textFieldSection}>
            <Text style={{ ...styles.label, color: theme.text.primary }}>
              Model URL
            </Text>
            <TextFieldInput
              value={remoteModelPath}
              multiline={true}
              onChangeText={setRemoteModelPath}
              placeholder="Enter external model URL"
            />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={{ ...styles.label, color: theme.text.primary }}>
              Tokenizer URL
            </Text>
            <TextFieldInput
              value={remoteTokenizerPath}
              multiline={true}
              onChangeText={setRemoteTokenizerPath}
              placeholder="Enter external tokenizer URL"
              onFocus={scrollToBottom}
            />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={{ ...styles.label, color: theme.text.primary }}>
              Tokenizer Config URL
            </Text>
            <TextFieldInput
              value={remoteTokenizerConfigPath}
              multiline={true}
              onChangeText={setRemoteTokenizerConfigPath}
              placeholder="Enter external config URL"
              onFocus={scrollToBottom}
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
    paddingBottom: Platform.OS === 'ios' ? 16 : 0,
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
