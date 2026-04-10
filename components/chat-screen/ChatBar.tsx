import React, {
  Ref,
  useImperativeHandle,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { SharedValue } from 'react-native-reanimated';
import AttachmentSheet from '../bottomSheets/AttachmentSheet';
import { useAttachment, Attachment } from '../../hooks/useAttachment';
import { Model } from '../../database/modelRepository';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { useLLMStore } from '../../store/llmStore';
import RotateLeft from '../../assets/icons/rotate_left.svg';
import { Theme } from '../../styles/colors';
import ChatBarActions from './ChatBarActions';
import ChatSpeechInput from './ChatSpeechInput';
import PromptSuggestions from './PromptSuggestions';
import AttachmentThumbnail from './AttachmentThumbnail';
import { AudioManager } from 'react-native-audio-api';
import Toast from 'react-native-toast-message';

interface Props {
  chatId: number | null;
  onSend: (userInput: string, imagePath?: string, attachments?: Attachment[]) => void;
  onSelectModel: () => void;
  onSelectPrompt: (prompt: string) => void;
  ref: Ref<{
    clear: () => void;
    setInput: (text: string) => void;
  }>;
  model: Model | undefined;
  isVisionModel: boolean;
  extraContentPadding: SharedValue<number>;
  thinkingEnabled: boolean;
  onThinkingToggle: () => void;
  hasMessages: boolean;
  onAttachmentSheetStateChange?: (isOpen: boolean) => void;
}

const ChatBar = ({
  chatId,
  onSend,
  onSelectModel,
  onSelectPrompt,
  ref,
  model,
  isVisionModel,
  extraContentPadding,
  thinkingEnabled,
  onThinkingToggle,
  hasMessages,
  onAttachmentSheetStateChange,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [userInput, setUserInput] = useState('');
  const {
    attachments,
    sheetRef,
    pickFromLibrary,
    pickFromCamera,
    pickDocument,
    removeAttachment,
    clearAll,
    openSheet,
  } = useAttachment();

  // Captured once from the first TextInput onLayout (empty single-line height)
  // and never reset — see feedback #6 on the rebase plan. Re-capturing from
  // onContentSizeChange after clear() races the iOS text-clear and can freeze
  // the composer at its multi-line height.
  const defaultInputHeight = useRef(0);
  // JS-managed height so clearing the text actually shrinks the composer
  // back to a single line. Without this, the TextInput's intrinsic height
  // on iOS sticks at the tallest measured contentSize even after value=''.
  const [inputHeight, setInputHeight] = useState<number | undefined>(undefined);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        setUserInput('');
        clearAll();
        extraContentPadding.value = 0;
        setInputHeight(defaultInputHeight.current || undefined);
      },
      setInput: (text: string) => {
        setUserInput(text);
        // Clear the explicit height so the TextInput auto-sizes to the
        // new content. onContentSizeChange will re-capture the height.
        setInputHeight(undefined);
      },
    }),
    [clearAll, extraContentPadding]
  );

  const handleInputLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      if (defaultInputHeight.current === 0) {
        defaultInputHeight.current = e.nativeEvent.layout.height;
      }
    },
    []
  );

  const handleInputContentSizeChange = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }) => {
      const baseline = defaultInputHeight.current;
      const newHeight = e.nativeEvent.contentSize.height;
      setInputHeight(newHeight);
      if (baseline === 0) return;
      extraContentPadding.value = Math.max(0, newHeight - baseline);
    },
    [extraContentPadding]
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

  const handleAttach = useCallback(() => {
    Keyboard.dismiss();
    loadSelectedModel();
    openSheet();
  }, [loadSelectedModel, openSheet]);

  const imageAttachment = attachments.find((a) => a.type === 'image');
  const hasLoadingAttachment = attachments.some((a) => a.status === 'loading');

  const handleSend = useCallback(() => {
    if (hasLoadingAttachment) return;
    onSend(userInput, imageAttachment?.uri, attachments);
    clearAll();
  }, [onSend, userInput, imageAttachment, attachments, clearAll, hasLoadingAttachment]);

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
        onSend(transcript, imageAttachment?.uri, attachments);
        clearAll();
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
            {attachments.length > 0 && (
              <>
                <View style={styles.previewRow}>
                  {attachments.map((attachment) => (
                    <AttachmentThumbnail
                      key={attachment.id}
                      attachment={attachment}
                      onRemove={() => removeAttachment(attachment.id)}
                    />
                  ))}
                </View>
                <View style={styles.divider} />
              </>
            )}
            <View style={styles.content}>
              <TextInput
                style={[styles.input, inputHeight ? { height: inputHeight } : null]}
                multiline
                onFocus={async () => {
                  await loadSelectedModel();
                }}
                onLayout={handleInputLayout}
                onContentSizeChange={handleInputContentSizeChange}
                placeholder="Ask about anything..."
                placeholderTextColor={theme.text.contrastTertiary}
                value={userInput}
                onChangeText={setUserInput}
                numberOfLines={3}
              />
            </View>
            <ChatBarActions
              onAttach={handleAttach}
              hasAttachments={attachments.length > 0}
              isLoadingAttachment={hasLoadingAttachment}
              userInput={userInput}
              onSend={handleSend}
              isGenerating={isGenerating}
              isProcessingPrompt={isProcessingPrompt}
              onInterrupt={interrupt}
              onSpeechInput={openSpeechInput}
              thinkingEnabled={thinkingEnabled}
              onThinkingToggle={onThinkingToggle}
            />
          </View>
          <AttachmentSheet
            bottomSheetModalRef={sheetRef}
            isVisionModel={isVisionModel}
            onPickFromLibrary={pickFromLibrary}
            onPickFromCamera={pickFromCamera}
            onPickDocument={pickDocument}
            onSheetStateChange={onAttachmentSheetStateChange}
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
      paddingBottom: theme.insets.bottom + 16,
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
      gap: 8,
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
