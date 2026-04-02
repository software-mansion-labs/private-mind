import React, {
  Ref,
  RefObject,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  useCallback,
} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Image,
  ActionSheetIOS,
  Platform,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import { Model } from '../../database/modelRepository';
import { ChatSettings } from '../../database/chatRepository';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { useLLMStore } from '../../store/llmStore';
import { ScrollView } from 'react-native-gesture-handler';
import RotateLeft from '../../assets/icons/rotate_left.svg';
import { Theme } from '../../styles/colors';
import ChatBarActions from './ChatBarActions';
import ChatSpeechInput from './ChatSpeechInput';
import PromptSuggestions from './PromptSuggestions';
import { AudioManager } from 'react-native-audio-api';
import Toast from 'react-native-toast-message';

interface Props {
  chatId: number | null;
  onSend: (userInput: string, imagePath?: string) => void;
  onSelectModel: () => void;
  onSelectSource: () => void;
  onSelectPrompt: (prompt: string) => void;
  ref: Ref<{
    clear: () => void;
    setInput: (text: string) => void;
  }>;
  model: Model | undefined;
  scrollRef: RefObject<ScrollView | null>;
  isAtBottom: boolean;
  activeSourcesCount: number;
  thinkingEnabled: boolean;
  onThinkingToggle: () => void;
  hasMessages: boolean;
}

const ChatBar = ({
  chatId,
  onSend,
  onSelectModel,
  onSelectSource,
  onSelectPrompt,
  ref,
  model,
  scrollRef,
  isAtBottom,
  activeSourcesCount,
  thinkingEnabled,
  onThinkingToggle,
  hasMessages,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [userInput, setUserInput] = useState('');
  const [imagePath, setImagePath] = useState<string | undefined>(undefined);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => { setUserInput(''); setImagePath(undefined); },
      setInput: (text: string) => setUserInput(text),
    }),
    []
  );

  const {
    isGenerating,
    isProcessingPrompt,
    interrupt,
    loadModel,
    model: loadedModel,
  } = useLLMStore();
  const loadSelectedModel = async () => {
    if (model?.isDownloaded && loadedModel?.id !== model.id) {
      return loadModel(model);
    }
  };

  const isVisionModel = model?.vision === true;

  useEffect(() => {
    if (!isVisionModel) {
      setImagePath(undefined);
    }
  }, [isVisionModel]);

  const toJpegCacheUri = (uri: string): string => {
    const dest = new File(Paths.cache, `vlm_input_${Date.now()}.jpg`);
    new File(uri).copy(dest);
    return dest.uri;
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled) {
      setImagePath(toJpegCacheUri(result.assets[0].uri));
    }
  };

  const pickFromCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled) {
      setImagePath(toJpegCacheUri(result.assets[0].uri));
    }
  };

  const handleAttachImage = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Photo Library', 'Camera'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickFromLibrary();
          else if (buttonIndex === 2) pickFromCamera();
        }
      );
    } else {
      Alert.alert('Attach Image', 'Choose source', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Photo Library', onPress: pickFromLibrary },
        { text: 'Camera', onPress: pickFromCamera },
      ]);
    }
  };

  const handleSend = () => {
    onSend(userInput, imagePath);
    setImagePath(undefined);
  };

  const [showSpeechInput, setShowSpeechInput] = React.useState(false);

  const openSpeechInput = async () => {
    const permissionStatus = await AudioManager.requestRecordingPermissions();
    if (permissionStatus !== 'Granted') {
      Toast.show({
        type: 'defaultToast',
        text1: 'Microphone permission is required to record messages.',
      });
      return;
    }

    loadSelectedModel();
    setShowSpeechInput(true);
  };

  if (showSpeechInput) {
    const handleSubmit = (transcript: string) => {
      setShowSpeechInput(false);
      if (transcript) {
        onSend(transcript);
      }
    };

    return (
      <View style={styles.container}>
        <ChatSpeechInput
          onSubmit={handleSubmit}
          onCancel={() => setShowSpeechInput(false)}
        />
      </View>
    );
  }

  if (chatId && !model) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.modelSelection} onPress={onSelectModel}>
          <Text style={styles.selectedModel}>Select Model</Text>
          <RotateLeft
            width={20}
            height={20}
            style={{ color: theme.text.primary }}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {model?.isDownloaded && (
        <>
          {!hasMessages && (
            <View style={styles.suggestionsContainer}>
              <PromptSuggestions onSelectPrompt={onSelectPrompt} />
            </View>
          )}
          <View style={styles.inputContainer}>
            {imagePath && (
              <>
                <View style={styles.previewRow}>
                  <View style={styles.thumbnailWrapper}>
                    <Image
                      source={{ uri: imagePath }}
                      style={styles.thumbnail}
                      testID="image-preview"
                    />
                    <TouchableOpacity
                      style={styles.dismissButton}
                      onPress={() => setImagePath(undefined)}
                      testID="dismiss-image-btn"
                    >
                      <Text style={styles.dismissText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.divider} />
              </>
            )}
            <View style={styles.content}>
              {isVisionModel && (
                <TouchableOpacity
                  style={styles.attachButton}
                  onPress={handleAttachImage}
                  testID="attach-image-btn"
                >
                  <Text style={styles.attachText}>+</Text>
                </TouchableOpacity>
              )}
              <TextInput
                style={styles.input}
                multiline
                onFocus={async () => {
                  if (!isAtBottom) return;
                  await loadSelectedModel();
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 25);
                }}
                placeholder="Ask about anything..."
                placeholderTextColor={theme.text.contrastTertiary}
                value={userInput}
                onChangeText={setUserInput}
                numberOfLines={3}
              />
            </View>
            <ChatBarActions
              onSelectSource={onSelectSource}
              activeSourcesCount={activeSourcesCount}
              userInput={userInput}
              imagePath={imagePath}
              onSend={handleSend}
              isGenerating={isGenerating}
              isProcessingPrompt={isProcessingPrompt}
              onInterrupt={interrupt}
              onSpeechInput={openSpeechInput}
              thinkingEnabled={thinkingEnabled}
              onThinkingToggle={onThinkingToggle}
            />
          </View>
        </>
      )}
    </View>
  );
};

export default ChatBar;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'column',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    suggestionsContainer: {
      marginBottom: 12,
    },
    modelSelection: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: 52,
      borderWidth: 1,
      borderColor: theme.border.soft,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    selectedModel: {
      fontSize: 14,
      fontFamily: fontFamily.regular,
      color: theme.text.primary,
    },
    content: {
      flexDirection: 'row',
      width: '100%',
    },
    inputContainer: {
      flexDirection: 'column',
      backgroundColor: theme.bg.strongPrimary,
      borderRadius: 18,
      padding: 16,
      gap: 16,
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      fontFamily: fontFamily.regular,
      textAlignVertical: 'center',
      color: theme.text.contrastPrimary,
    },
    attachButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 8,
    },
    attachText: {
      fontSize: 24,
      lineHeight: 28,
      color: theme.text.contrastPrimary,
      fontFamily: fontFamily.regular,
    },
    previewRow: {
      flexDirection: 'row',
      paddingBottom: 8,
    },
    thumbnailWrapper: {
      position: 'relative',
    },
    thumbnail: {
      width: 72,
      height: 72,
      borderRadius: 8,
    },
    dismissButton: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    dismissText: {
      color: '#fff',
      fontSize: 10,
      lineHeight: 12,
    },
    divider: {
      height: 1,
      backgroundColor: theme.border.soft,
      marginBottom: 8,
    },
    buttonBar: {
      justifyContent: 'center',
      alignItems: 'flex-end',
    },
    barButton: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContrast: {
      color: theme.text.contrastPrimary,
    },
  });
