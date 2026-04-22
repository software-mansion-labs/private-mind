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
  TextInput as RNTextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Keyboard,
  Platform,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { type PasteEventPayload, TextInputWrapper } from 'expo-paste-input';
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
import WhatsNewCard from '../WhatsNewCard';
import AttachmentThumbnail from './AttachmentThumbnail';
import { AudioManager } from 'react-native-audio-api';
import Toast from 'react-native-toast-message';

interface Props {
  chatId: number | null;
  onSend: (
    userInput: string,
    imagePath?: string,
    attachments?: Attachment[]
  ) => void;
  onSelectModel: () => void;
  onSelectPrompt: (prompt: string) => void;
  ref: Ref<{
    clear: () => void;
    setInput: (text: string) => void;
  }>;
  model: Model | undefined;
  isVisionModel: boolean;
  extraContentPadding: SharedValue<number>;
  onHeightChange?: (height: number) => void;
  onBarGrow?: () => void;
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
  onHeightChange,
  onBarGrow,
  thinkingEnabled,
  onThinkingToggle,
  hasMessages,
  onAttachmentSheetStateChange,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const containerStyle = useMemo(
    () => [styles.container, { paddingBottom: theme.insets.bottom + 16 }],
    [styles.container, theme.insets.bottom]
  );

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
    addPastedAttachment,
  } = useAttachment();

  const defaultBarHeight = useRef(0);
  const textInputRef = useRef<RNTextInput>(null);
  // iOS-only: bump the TextInput key to force a remount when a prompt
  // suggestion is set programmatically. iOS doesn't re-fire onLayout
  // for grow after the input has previously grown and shrunk, so
  // remounting is the only reliable way to make it grow to fit the
  // new content.
  const [iosInputKey, setIosInputKey] = useState(0);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        setUserInput('');
        clearAll();
        extraContentPadding.value = 0;
        if (Platform.OS === 'ios') {
          textInputRef.current?.setNativeProps({ text: ' ' });
          textInputRef.current?.setNativeProps({ text: '' });
        }
      },
      setInput: (text: string) => {
        setUserInput(text);
        if (Platform.OS === 'ios') {
          setIosInputKey((k) => k + 1);
        }
      },
    }),
    [clearAll, extraContentPadding]
  );

  const handleBarLayoutForPadding = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const height = e.nativeEvent.layout.height;
      // Only capture the default height once we're in the "with messages"
      // layout — otherwise the empty-state extras (WhatsNewCard, prompt
      // suggestions) would bake into the baseline and squeeze the scroll
      // view once they disappear.
      if (defaultBarHeight.current === 0 && hasMessages) {
        defaultBarHeight.current = height;
      }
      const baseline = defaultBarHeight.current || height;
      const delta = height - baseline;
      extraContentPadding.value = Math.max(0, delta);
      onHeightChange?.(height);
      if (delta > 0) {
        onBarGrow?.();
      }
    },
    [extraContentPadding, onHeightChange, hasMessages]
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
  }, [
    onSend,
    userInput,
    imageAttachment,
    attachments,
    clearAll,
    hasLoadingAttachment,
  ]);

  const onPaste = useCallback(
    (payload: PasteEventPayload) => {
      try {
        if (payload.type === 'text') {
          return;
        }

        if (payload.type === 'images' && payload.uris?.length > 0) {
          if (!isVisionModel) {
            Toast.show({
              type: 'defaultToast',
              text1: 'This model does not support images',
            });
            return;
          }
          payload.uris.forEach((uri) => addPastedAttachment(uri));
          return;
        }

        if (payload.type === 'unsupported') {
          Toast.show({
            type: 'defaultToast',
            text1: 'Unsupported clipboard content',
          });
        }
      } catch {
        Toast.show({
          type: 'defaultToast',
          text1: 'Error processing pasted content',
        });
      }
    },
    [addPastedAttachment, isVisionModel]
  );

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
      <View style={containerStyle} onLayout={handleBarLayoutForPadding}>
        <ChatSpeechInput
          onSubmit={handleSubmit}
          onCancel={() => setShowSpeechInput(false)}
        />
      </View>
    );
  }

  if (chatId && !model) {
    return (
      <View style={containerStyle} onLayout={handleBarLayoutForPadding}>
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
    <View style={containerStyle} onLayout={handleBarLayoutForPadding}>
      {model?.isDownloaded && (
        <>
          {!hasMessages && (
            <View style={styles.suggestionsContainer}>
              <WhatsNewCard />
              <PromptSuggestions onSelectPrompt={onSelectPrompt} />
            </View>
          )}
          <View style={styles.inputContainer}>
            {attachments.length > 0 && (
              <View style={[styles.previewRow, { marginBottom: 8 }]}>
                {attachments.map((attachment) => (
                  <AttachmentThumbnail
                    key={attachment.id}
                    attachment={attachment}
                    onRemove={() => removeAttachment(attachment.id)}
                  />
                ))}
              </View>
            )}
            <View style={styles.content}>
              <TextInputWrapper
                onPaste={onPaste}
                style={styles.textInputWrapper}
              >
                <RNTextInput
                  key={Platform.OS === 'ios' ? iosInputKey : undefined}
                  ref={textInputRef}
                  style={styles.input}
                  multiline
                  numberOfLines={3}
                  onFocus={async () => {
                    await loadSelectedModel();
                  }}
                  placeholder="Ask about anything..."
                  placeholderTextColor={theme.text.onChatBarMuted}
                  value={userInput}
                  onChangeText={setUserInput}
                />
              </TextInputWrapper>
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
    },
    suggestionsContainer: {
      marginBottom: 12,
      gap: 12,
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
      backgroundColor: theme.bg.chatBar,
      borderRadius: 18,
      padding: 16,
      gap: 8,
      justifyContent: 'center',
    },
    textInputWrapper: {
      flex: 1,
    },
    input: {
      fontSize: fontSizes.md,
      // lineHeight on Android causes typed text to be taller than the
      // placeholder, making the ChatBar jump on first keystroke.
      ...(Platform.OS === 'ios' && { lineHeight: lineHeights.md }),
      fontFamily: fontFamily.regular,
      textAlignVertical: 'center',
      color: theme.text.onChatBar,
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
      color: theme.text.onChatBar,
    },
  });
