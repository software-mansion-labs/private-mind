import React, {
  Ref,
  useEffect,
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
import Animated, {
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { type PasteEventPayload, TextInputWrapper } from 'expo-paste-input';
import EmbeddingDownloadSheet from '../bottomSheets/EmbeddingDownloadSheet';
import {
  useAttachment,
  Attachment,
  MAX_IMAGE_ATTACHMENTS,
  type LibraryImage,
} from '../../hooks/useAttachment';
import AttachmentOverlay from './attachments/AttachmentOverlay';
import { COMPOSER, COMPOSER_STRIP_HEIGHT } from './attachments/constants';
import { useAttachmentFlights } from './attachments/useAttachmentFlights';
import { useAttachmentPanel } from './attachments/useAttachmentPanel';
import { useSheetGeometry } from './attachments/useSheetGeometry';
import { Model } from '../../database/modelRepository';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useChatStore } from '../../store/chatStore';
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
import type { SendRefusal } from './useSendChatMessage';
import {
  BAR_GROW_DURATION,
  BAR_GROW_LAYOUT,
  useBarGrowth,
} from './useBarGrowth';

const SENT_ECHO_WINDOW_MS = 300;

/** What the composer says when a send does not happen. `image-not-saved` has
 *  already said it itself. */
const REFUSAL_COPY: Record<SendRefusal, string | null> = {
  'nothing-to-send': 'Add a message or an attachment first.',
  'model-loading': 'Wait for the model to finish loading.',
  'busy': 'Wait for the response to finish or stop it first.',
  'chat-not-created': 'Could not start this chat. Try again.',
  'image-not-saved': null,
};

interface Props {
  chatId: number | null;
  onSend: (
    userInput: string,
    imagePath?: string,
    attachments?: Attachment[]
  ) => boolean | void | SendRefusal | Promise<boolean | void | SendRefusal>;
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

  const phantomChatStarts = useChatStore((state) => state.phantomChatStarts);
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
    embeddingDownloadSheetRef,
    addImages,
    presentDownloadSheet,
    pickDocument,
    addUrlSource,
    downloadModelAndContinue,
    markDownloadSheetClosed,
    markPanelOpen,
    markPanelClosed,
    removeAttachment,
    restoreAttachments,
    clearAll,
    addPastedAttachment,
  } = useAttachment();

  // Measured by the overlay off the window it is hosted in, which on Android
  // is not always the app's own.
  const [panelWindowHeight, setPanelWindowHeight] = useState<number>();

  const {
    width: screenWidth,
    composerBottom,
    gridWidth,
    gridHeight,
    sheetTop,
    sheetBottom,
    menuMaxBottom,
  } = useSheetGeometry(panelWindowHeight);

  // The Files row holds the menu up while the OS presents the picker, and
  // before that while the store it needs settles. Both are silent, so the row
  // says it is working for as long as it is.
  const [filesBusy, setFilesBusy] = useState(false);
  const handleSelectFiles = useCallback(() => {
    setFilesBusy(true);
    return pickDocument()
      .catch((error) => {
        console.error('Failed to open the document picker:', error);
      })
      .finally(() => setFilesBusy(false));
  }, [pickDocument]);

  // Answered inside the panel rather than with a toast — see `AttachmentMenu`.
  const [imagesUnsupportedAt, setImagesUnsupportedAt] = useState(0);
  const showImagesUnsupported = useCallback(() => {
    setImagesUnsupportedAt(Date.now());
  }, []);

  const panel = useAttachmentPanel({
    onSelectFiles: handleSelectFiles,
    canAttachImages: isVisionModel,
    onImagesUnsupported: showImagesUnsupported,
  });

  const handleAttachPhotos = useCallback(
    (photos: LibraryImage[]) => {
      addImages(photos).catch((error) => {
        console.error('Failed to attach the picked photos:', error);
      });
    },
    [addImages]
  );

  const { flights, isFlying, attach, strip, attachAndLeave } =
    useAttachmentFlights({
      hasAttachments: attachments.length > 0,
      onAttachPhotos: handleAttachPhotos,
      collapsePanel: panel.collapseForLeave,
      resetPanel: panel.resetAfterLeave,
    });

  /**
   * Height of everything below the strip inside the composer card. The bar's
   * bottom edge is pinned and the strip grows it upward, so this is what the
   * flight subtracts to find the slot it is aiming at.
   */
  const rowsBelowStrip = useSharedValue(0);
  const handleRowsBelowStripLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      rowsBelowStrip.set(e.nativeEvent.layout.height + COMPOSER.cardPadding);
    },
    [rowsBelowStrip]
  );

  const stripStyle = useAnimatedStyle(() => ({
    height: strip.get() * COMPOSER_STRIP_HEIGHT,
  }));

  // The reference keeps a `retained` copy of the attachments so the strip has
  // content while it animates shut, driven by a `useAnimatedReaction` on the
  // strip value. Deliberately not ported: under Bundle Mode a worklet from a
  // hot-reloaded module can be missing from the worklet bundle, and Reanimated
  // then throws "react is not a function" straight into a redbox. The strip
  // renders the attachments themselves and each thumbnail's own `FadeOut`
  // covers a removal.

  /** Photos still in the air: their thumbnails stay blank so no photo is ever
   *  on screen twice. */
  const pendingIds = flights.map((flight) => flight.photo.id);

  // The document picker's download gate waits for the panel to be gone.
  useEffect(() => {
    if (panel.mode === 'closed') markPanelClosed();
    else markPanelOpen();
  }, [panel.mode, markPanelClosed, markPanelOpen]);

  useEffect(() => {
    onAttachmentSheetStateChange?.(panel.mode !== 'closed');
  }, [panel.mode, onAttachmentSheetStateChange]);

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

  const composerKey = `${chatId}:${phantomChatStarts}`;
  const composerKeyRef = useRef(composerKey);
  if (composerKeyRef.current !== composerKey) {
    composerKeyRef.current = composerKey;
    setUserInput('');
    lastSentRef.current = null;
    if (Platform.OS === 'ios') setIosInputKey((key) => key + 1);
  }

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
  } = useLLMStore();
  const loadSelectedModel = useCallback(async () => {
    if (model?.isDownloaded && loadedModel?.id !== model.id) {
      return loadModel(model);
    }
  }, [model, loadedModel, loadModel]);

  // Deliberately no model offload around the picker. The old bottom sheet
  // handed off to the system photo picker and camera, which run in their own
  // processes and needed the room; this panel is in-process, so unloading the
  // model only to load it again seconds later is pure cost — and on a 6GB
  // device that reload is what got the app killed mid-flight.

  const imageAttachment = attachments.find((a) => a.type === 'image');
  const hasLoadingAttachment = attachments.some((a) => a.status === 'loading');

  const showModelSwitchingToast = useCallback(() => {
    Toast.show({
      type: 'defaultToast',
      text1: 'Wait for the model to finish loading.',
    });
  }, []);

  const handleAttach = useCallback(() => {
    // Reaching for an attachment is reaching to send, so the model starts
    // loading here as it does when the field is focused. Without it, attaching
    // a photo and sending it with no text at all never asked for a model, and
    // the send was turned away by a store that had none.
    loadSelectedModel();
    // No `Keyboard.dismiss()`: the panel is anchored to the keyboard and is
    // hosted in the window above it, so the keyboard stays up throughout.
    panel.onPlusPress();
  }, [loadSelectedModel, panel]);

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
    const attachmentsToSend = attachments;
    const imageUriToSend = imageAttachment?.uri;
    const inputToSend = userInput;
    const outcome = onSend(inputToSend, imageUriToSend, attachmentsToSend);
    Keyboard.dismiss();

    lastSentRef.current = inputToSend
      ? { text: inputToSend, at: Date.now() }
      : null;
    if (Platform.OS === 'ios') {
      textInputRef.current?.blur();
      setIosInputKey((key) => key + 1);
    }
    setUserInput('');
    clearAll({ cleanupSources: false });
    Promise.resolve(outcome)
      .then((accepted) => {
        if (accepted !== false && typeof accepted !== 'string') return;
        // The composer was emptied on the tap, before the answer came back.
        // Everything it was carrying goes back, the photo included — it used
        // to put the text back and drop the attachment on the floor.
        lastSentRef.current = null;
        setUserInput((current) => current || inputToSend);
        if (attachmentsToSend.length) restoreAttachments(attachmentsToSend);
        const text1 = REFUSAL_COPY[accepted === false ? 'busy' : accepted];
        if (text1) Toast.show({ type: 'defaultToast', text1 });
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
    restoreAttachments,
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
            {/* A clipped window on the strip: the thumbnails are pinned at
                full size to its top, so a half-open strip shows the top of the
                photos rather than a squashed copy. */}
            <Animated.View
              pointerEvents={attachments.length ? 'auto' : 'none'}
              style={[styles.strip, stripStyle]}
            >
              <View style={styles.stripRow}>
                {attachments.map((attachment) => (
                  <Animated.View
                    key={attachment.id}
                    exiting={FadeOut.duration(BAR_GROW_DURATION)}
                    layout={BAR_GROW_LAYOUT}
                  >
                    {/* The hide lives on a plain inner view: a layout animation
                        owns its target's opacity, so cutting a pending photo on
                        the animated wrapper leaves the thumbnail stuck at 0
                        once the flight lands. */}
                    <View
                      style={
                        pendingIds.includes(attachment.id)
                          ? styles.stripPending
                          : undefined
                      }
                    >
                      <AttachmentThumbnail
                        attachment={attachment}
                        onRemove={() => removeAttachment(attachment.id)}
                      />
                    </View>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
            <View
              style={styles.belowStrip}
              onLayout={handleRowsBelowStripLayout}
            >
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
                plusOut={panel.plusOut}
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
          </View>
          <AttachmentOverlay
            panel={panel}
            onWindowHeight={setPanelWindowHeight}
            imagesUnsupportedAt={imagesUnsupportedAt}
            busyAction={filesBusy ? 'files' : null}
            width={screenWidth}
            gridWidth={gridWidth}
            gridHeight={gridHeight}
            menuMaxBottom={menuMaxBottom}
            sheetTop={sheetTop}
            sheetBottom={sheetBottom}
            composerBottom={composerBottom}
            rowsBelowStrip={rowsBelowStrip}
            strip={strip}
            attach={attach}
            flights={flights}
            isFlying={isFlying}
            attachAndLeave={attachAndLeave}
            attachedIds={attachments.map((attachment) => attachment.id)}
            maxSelection={MAX_IMAGE_ATTACHMENTS}
            imagesEnabled={isVisionModel}
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
      padding: COMPOSER.cardPadding,
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
    strip: {
      overflow: 'hidden',
    },
    stripRow: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: COMPOSER.stripPaddingTop,
      flexDirection: 'row',
      gap: COMPOSER.thumbGap,
    },
    /** A photo still in the air: its slot is held, but nothing is drawn in it. */
    stripPending: {
      opacity: 0,
    },
    belowStrip: {
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
