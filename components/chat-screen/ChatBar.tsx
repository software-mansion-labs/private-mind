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
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import ImageSourceSheet from '../bottomSheets/ImageSourceSheet';
import { useImageAttachment } from '../../hooks/useImageAttachment';
import { Model } from '../../database/modelRepository';
import { ChatSettings } from '../../database/chatRepository';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { useLLMStore } from '../../store/llmStore';
import { ScrollView } from 'react-native-gesture-handler';
import RotateLeft from '../../assets/icons/rotate_left.svg';
import CloseIcon from '../../assets/icons/close.svg';
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
  const {
    imagePath,
    isLoadingImage,
    imageSourceSheetRef,
    pickFromLibrary,
    pickFromCamera,
    openSourceSheet: openImageSourceSheet,
    clearImage,
  } = useImageAttachment();

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        setUserInput('');
        clearImage();
      },
      setInput: (text: string) => setUserInput(text),
    }),
    [clearImage]
  );

  const {
    isGenerating,
    isProcessingPrompt,
    interrupt,
    loadModel,
    model: loadedModel,
  } = useLLMStore();
  const loadSelectedModel = useCallback(async () => {
    if (model?.isDownloaded && loadedModel?.id !== model.id) {
      return loadModel(model);
    }
  }, [model, loadedModel, loadModel]);

  const handleAttachImage = useCallback(() => {
    Keyboard.dismiss();
    loadSelectedModel();
    openImageSourceSheet();
  }, [loadSelectedModel, openImageSourceSheet]);

  const isVisionModel = model?.vision === true;

  useEffect(() => {
    if (!isVisionModel) {
      clearImage();
    }
  }, [isVisionModel]);

  const handleSend = useCallback(() => {
    onSend(userInput, imagePath);
    clearImage();
  }, [onSend, userInput, imagePath, clearImage]);

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
        onSend(transcript, imagePath);
        clearImage();
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
            {(imagePath || isLoadingImage) && (
              <>
                <View style={styles.previewRow}>
                  <View style={styles.thumbnailWrapper}>
                    {imagePath ? (
                      <Image
                        source={{ uri: imagePath }}
                        style={styles.thumbnail}
                        testID="image-preview"
                      />
                    ) : (
                      <View style={styles.thumbnailPlaceholder}>
                        <ActivityIndicator color={theme.text.contrastPrimary} />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.dismissButton}
                      onPress={clearImage}
                      testID="dismiss-image-btn"
                    >
                      <CloseIcon
                        width={8}
                        height={8}
                        style={styles.dismissIcon}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.divider} />
              </>
            )}
            <View style={styles.content}>
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
              isVisionModel={isVisionModel}
              onAttachImage={handleAttachImage}
            />
          </View>
          <ImageSourceSheet
            bottomSheetModalRef={imageSourceSheetRef}
            onPickFromLibrary={pickFromLibrary}
            onPickFromCamera={pickFromCamera}
          />
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
      gap: 8,
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
    previewRow: {
      flexDirection: 'row',
    },
    thumbnailWrapper: {
      position: 'relative',
    },
    thumbnailPlaceholder: {
      width: 72,
      height: 72,
      borderRadius: 8,
      backgroundColor: theme.bg.softSecondary,
      justifyContent: 'center',
      alignItems: 'center',
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
      backgroundColor: theme.bg.softSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dismissIcon: {
      color: theme.text.primary,
    },
    divider: {
      height: 1,
      backgroundColor: theme.border.soft,
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
