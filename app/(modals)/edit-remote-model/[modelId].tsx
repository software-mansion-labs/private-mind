import React, { useRef, useState } from 'react';
import { Text, StyleSheet, Alert, Platform, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useModelStore } from '../../../store/modelStore';
import GlassScreenHeader, {
  useGlassScreenHeaderHeight,
} from '../../../components/GlassScreenHeader';
import TextFieldInput from '../../../components/TextFieldInput';
import { fontSizes, fontFamily } from '../../../styles/fontStyles';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import PrimaryButton from '../../../components/PrimaryButton';
import { ScrollView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { InfoAlert } from '../../../components/InfoAlert';
import { Theme } from '../../../styles/colors';
import { RemoteModelFormState } from '../add-remote-model';
import { CustomKeyboardAvoidingView } from '../../../components/CustomKeyboardAvoidingView';
import { Feedback } from '../../../utils/Feedback';
import { space } from '../../../constants/design-system';

interface EditModelFormState extends RemoteModelFormState {
  modelName: string;
}

export default function EditRemoteModelScreen() {
  const { modelId: rawModelId } = useLocalSearchParams<{ modelId: string }>();
  const modelId = parseInt(rawModelId);
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();

  const headerHeight = useGlassScreenHeaderHeight(true);
  const { styles } = useThemedStyles(createStyles, headerHeight);

  const { getModelById, editModel } = useModelStore();
  const model = getModelById(modelId);

  const [
    {
      modelName,
      remoteModelPath,
      remoteTokenizerPath,
      remoteTokenizerConfigPath,
    },
    setFormState,
  ] = useState<EditModelFormState>({
    modelName: model?.modelName || '',
    remoteModelPath: model?.modelPath || '',
    remoteTokenizerPath: model?.tokenizerPath || '',
    remoteTokenizerConfigPath: model?.tokenizerConfigPath || '',
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
    if (
      !remoteModelPath ||
      !remoteTokenizerPath ||
      !remoteTokenizerConfigPath
    ) {
      Alert.alert('Missing Fields', 'Please select all necessary files.');
      return;
    }
    await editModel(
      modelId,
      remoteTokenizerPath,
      remoteTokenizerConfigPath,
      modelName
    );
    Feedback.editSave();
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
    <CustomKeyboardAvoidingView
      isModalScreen
      style={styles.keyboardAvoidingView}
    >
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          ref={scrollViewRef}
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
            <TextFieldInput
              editable={false}
              value={remoteModelPath}
              multiline={true}
              onChangeText={(text) => setFormField('remoteModelPath', text)}
              placeholder="Enter external model URL"
            />
            <InfoAlert text="Model file is permanently linked to this model and cannot be changed" />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={styles.label}>Tokenizer URL</Text>
            <TextFieldInput
              value={remoteTokenizerPath}
              multiline={true}
              onChangeText={(text) => setFormField('remoteTokenizerPath', text)}
              placeholder="Enter external tokenizer URL"
              onFocus={scrollToBottom}
            />
          </View>
          <View style={styles.textFieldSection}>
            <Text style={styles.label}>Tokenizer Config URL</Text>
            <TextFieldInput
              value={remoteTokenizerConfigPath}
              multiline={true}
              onChangeText={(text) =>
                setFormField('remoteTokenizerConfigPath', text)
              }
              placeholder="Enter external config URL"
              onFocus={scrollToBottom}
            />
          </View>
        </ScrollView>
        <PrimaryButton text="Save changes" onPress={handleSave} />
      </View>
      <GlassScreenHeader
        title="Edit Remote Model"
        onBack={() => router.back()}
        icon="close"
        sheet
      />
    </CustomKeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme, headerHeight: number) =>
  StyleSheet.create({
    keyboardAvoidingView: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    container: {
      flex: 1,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + 16,
      justifyContent: 'space-between',
    },
    scrollViewContent: {
      gap: space.six,
      paddingTop: headerHeight + 24,
      paddingBottom: space.six,
    },
    textFieldSection: {
      gap: space.four,
    },
    label: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
  });
