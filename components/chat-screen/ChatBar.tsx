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
import Animated, { type SharedValue } from 'react-native-reanimated';
import { type PasteEventPayload, TextInputWrapper } from 'expo-paste-input';
import AttachmentSheet from '../bottomSheets/AttachmentSheet';
import EmbeddingDownloadSheet from '../bottomSheets/EmbeddingDownloadSheet';
import { useAttachment, Attachment } from '../../hooks/useAttachment';
import { Model } from '../../database/modelRepository';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useLLMStore } from '../../store/llmStore';
import RotateLeft from '../../assets/icons/rotate_left.svg';
import LinkIcon from '../../assets/icons/link-alt.svg';
import { detectUrls } from '../../utils/web/url/urlDetection';
import { hostname } from '../../utils/web/hostname';
import { Theme } from '../../styles/colors';
import ChatBarActions from './ChatBarActions';
import ChatSpeechInput from './ChatSpeechInput';
import PromptSuggestions from './PromptSuggestions';
import WhatsNewCard from '../WhatsNewCard';
import AttachmentThumbnail from './AttachmentThumbnail';
import { AudioManager } from 'react-native-audio-api';
import Toast from 'react-native-toast-message';
import { useEmbeddingDownloadPrompt } from './useEmbeddingDownloadPrompt';
import { BAR_GROW_LAYOUT, useBarGrowth } from './useBarGrowth';

const SENT_ECHO_WINDOW_MS = 300;

interface Props {
  chatId: number | null;
  onSend: (
    userInput: string,
    imagePath?: string,
    attachments?: Attachment[]
  ) => boolean | void | Promise<boolean | void>;
  onSelectModel: () => void;
  onSelectPrompt: (prompt: string) => void;
  ref: Ref<{
    setInput: (text: string) => void;
  }>;
  model: Model | undefined;
  isVisionModel: boolean;
  extraContentPadding: SharedValue<number>;
  onHeightChange?: (height: number) => void;
  onBarGrow?: () => void;
  thinkingEnabled: boolean;
  onThinkingToggle: () => void;
  webSearchEnabled?: boolean;
  onWebSearchToggle?: () => boolean | void;
  hasMessages: boolean;
  disabled?: boolean;
  modelSwitching?: boolean;
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
  webSearchEnabled,
  onWebSearchToggle,
  hasMessages,
  disabled = false,
  modelSwitching = false,
  onAttachmentSheetStateChange,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const containerStyle = useMemo(
    () => [styles.container, { paddingBottom: theme.insets.bottom + 16 }],
    [styles.container, theme.insets.bottom]
  );

  const [userInput, setUserInput] = useState('');
  const lastSentRef = useRef<{ text: string; at: number } | null>(null);

  const handleChangeText = useCallback((text: string) => {
    const justSent = lastSentRef.current;
    lastSentRef.current = null;
    if (
      justSent &&
      text === justSent.text &&
      Date.now() - justSent.at < SENT_ECHO_WINDOW_MS
    ) {
      return;
    }
    setUserInput(text);
  }, []);
  const {
    attachments,
    sheetRef,
    embeddingDownloadSheetRef,
    presentDownloadSheet,
    pickFromLibrary,
    pickFromCamera,
    pickDocument,
    addUrlSource,
    downloadModelAndContinue,
    markDownloadSheetClosed,
    markAttachmentSheetClosed,
    removeAttachment,
    clearAll,
    openSheet,
    addPastedAttachment,
  } = useAttachment();

  const {
    embeddingSheetContext,
    embeddingSheetRequired,
    handleWebSearchToggle,
    handleEmbeddingSheetDismiss,
  } = useEmbeddingDownloadPrompt({
    model,
    webSearchEnabled,
    onWebSearchToggle,
    presentDownloadSheet,
    markDownloadSheetClosed,
  });

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
      setInput: (text: string) => {
        setUserInput(text);
        if (Platform.OS === 'ios') {
          setIosInputKey((k) => k + 1);
        }
      },
    }),
    []
  );

  const handleBarLayoutForPadding = useBarGrowth({
    extraContentPadding,
    hasMessages,
    isResting: !userInput && attachments.length === 0,
    insetBottom: theme.insets.bottom,
    ...(onHeightChange ? { onHeightChange } : {}),
    ...(onBarGrow ? { onBarGrow } : {}),
  });

  const {
    isGenerating,
    isProcessingPrompt,
    interrupt,
    loadModel,
    model: loadedModel,
    runWithModelOffloaded,
  } = useLLMStore();
  const loadSelectedModel = useCallback(async () => {
    if (model?.isDownloaded && loadedModel?.id !== model.id) {
      return loadModel(model);
    }
  }, [model, loadedModel, loadModel]);

  const imageAttachment = attachments.find((a) => a.type === 'image');
  const hasLoadingAttachment = attachments.some((a) => a.status === 'loading');

  const showModelSwitchingToast = useCallback(() => {
    Toast.show({
      type: 'defaultToast',
      text1: 'Wait for the model to finish loading.',
    });
  }, []);

  const handleAttach = useCallback(() => {
    if (modelSwitching) {
      showModelSwitchingToast();
      return;
    }

    Keyboard.dismiss();
    openSheet();
    runWithModelOffloaded(async () => {}, { restore: false }).catch((error) => {
      console.error('Failed to offload model before attachment picker:', error);
    });
  }, [
    modelSwitching,
    openSheet,
    runWithModelOffloaded,
    showModelSwitchingToast,
  ]);

  const detectedUrl = useMemo(
    () => detectUrls(userInput)[0] ?? null,
    [userInput]
  );
  const showIndexChip =
    !!detectedUrl && !attachments.some((a) => a.type === 'document');
  const handleIndexUrl = useCallback(() => {
    if (!detectedUrl) return;
    addUrlSource(detectedUrl);
    setUserInput((prev) =>
      prev
        .replace(detectedUrl, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
    );
  }, [detectedUrl, addUrlSource]);

  const handleSend = useCallback(() => {
    if (modelSwitching) {
      showModelSwitchingToast();
      return;
    }
    if (hasLoadingAttachment || disabled) return;
    Keyboard.dismiss();
    const attachmentsToSend = attachments;
    const imageUriToSend = imageAttachment?.uri;
    const inputToSend = userInput;

    lastSentRef.current = inputToSend
      ? { text: inputToSend, at: Date.now() }
      : null;
    if (Platform.OS === 'ios') {
      textInputRef.current?.blur();
      setIosInputKey((key) => key + 1);
    }
    setUserInput('');
    clearAll({ cleanupSources: false });
    Promise.resolve(onSend(inputToSend, imageUriToSend, attachmentsToSend))
      .then((accepted) => {
        if (accepted !== false) return;
        lastSentRef.current = null;
        setUserInput((current) => current || inputToSend);
        Toast.show({
          type: 'defaultToast',
          text1: 'Wait for the response to finish or stop it first.',
        });
      })
      .catch((error) => {
        console.error('Failed to send message:', error);
      });
  }, [
    onSend,
    userInput,
    imageAttachment,
    attachments,
    clearAll,
    hasLoadingAttachment,
    disabled,
    modelSwitching,
    showModelSwitchingToast,
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

  const [showSpeechInput, setShowSpeechInput] = useState(false);

  const openSpeechInput = async () => {
    if (modelSwitching) {
      showModelSwitchingToast();
      return;
    }
    if (disabled) return;

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
      if (modelSwitching) {
        showModelSwitchingToast();
        return;
      }
      if (disabled) return;

      setShowSpeechInput(false);
      if (transcript) {
        const attachmentsToSend = attachments;
        const imageUriToSend = imageAttachment?.uri;
        clearAll({ cleanupSources: false });
        Promise.resolve(
          onSend(transcript, imageUriToSend, attachmentsToSend)
        ).catch((error) => {
          console.error('Failed to send transcript:', error);
        });
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
    <Animated.View
      testID="chat-bar"
      style={containerStyle}
      onLayout={handleBarLayoutForPadding}
      layout={hasMessages ? BAR_GROW_LAYOUT : undefined}
    >
      {model?.isDownloaded && (
        <>
          {!hasMessages && (
            <View style={styles.suggestionsContainer}>
              <WhatsNewCard />
              <PromptSuggestions onSelectPrompt={onSelectPrompt} />
            </View>
          )}
          <View style={styles.inputContainer}>
            {showIndexChip && (
              <TouchableOpacity
                style={styles.indexUrlChip}
                onPress={handleIndexUrl}
                testID="index-url-chip"
              >
                <LinkIcon
                  width={16}
                  height={16}
                  style={{ color: theme.text.onChatBar }}
                />
                <Text style={styles.indexUrlChipText} numberOfLines={1}>
                  Index {hostname(detectedUrl!)}
                </Text>
              </TouchableOpacity>
            )}
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
                  onFocus={() => loadSelectedModel()}
                  placeholder="Ask about anything..."
                  placeholderTextColor={theme.text.onChatBarMuted}
                  value={userInput}
                  onChangeText={handleChangeText}
                />
              </TextInputWrapper>
            </View>
            <ChatBarActions
              onAttach={handleAttach}
              hasAttachments={attachments.length > 0}
              isLoadingAttachment={hasLoadingAttachment}
              disabled={disabled}
              userInput={userInput}
              onSend={handleSend}
              isGenerating={isGenerating}
              isProcessingPrompt={isProcessingPrompt}
              onInterrupt={interrupt}
              onSpeechInput={openSpeechInput}
              thinkingEnabled={thinkingEnabled}
              onThinkingToggle={onThinkingToggle}
              webSearchEnabled={webSearchEnabled}
              onWebSearchToggle={
                onWebSearchToggle ? handleWebSearchToggle : undefined
              }
            />
          </View>
          <AttachmentSheet
            bottomSheetModalRef={sheetRef}
            isVisionModel={isVisionModel}
            onPickFromLibrary={pickFromLibrary}
            onPickFromCamera={pickFromCamera}
            onPickDocument={pickDocument}
            onSheetStateChange={onAttachmentSheetStateChange}
            onDismissed={markAttachmentSheetClosed}
          />
          <EmbeddingDownloadSheet
            bottomSheetModalRef={embeddingDownloadSheetRef}
            onDownload={downloadModelAndContinue}
            onDismiss={handleEmbeddingSheetDismiss}
            context={embeddingSheetContext}
            required={embeddingSheetRequired}
          />
        </>
      )}
    </Animated.View>
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
      ...(Platform.OS === 'ios'
        ? { lineHeight: lineHeights.md }
        : { includeFontPadding: false }),
      fontFamily: fontFamily.regular,
      textAlignVertical: 'center',
      color: theme.text.onChatBar,
    },
    previewRow: {
      flexDirection: 'row',
      gap: 8,
    },
    indexUrlChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: theme.text.onChatBar,
      marginBottom: 8,
      maxWidth: '100%',
    },
    indexUrlChipText: {
      color: theme.text.onChatBar,
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.regular,
      flexShrink: 1,
    },
  });
