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
  Platform,
} from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
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

const BAR_GROW_DURATION = 200;
const BAR_GROW_EASING = Easing.out(Easing.ease);
const BAR_GROW_LAYOUT =
  LinearTransition.duration(BAR_GROW_DURATION).easing(BAR_GROW_EASING);

interface Props {
  chatId: number | null;
  onSend: (
    userInput: string,
    imagePath?: string,
    attachments?: Attachment[]
  ) => void | Promise<void>;
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
  const {
    attachments,
    embeddingDownloadSheetRef,
    addImages,
    pickDocument,
    downloadModelAndContinue,
    markDownloadSheetClosed,
    markPanelOpen,
    markPanelClosed,
    removeAttachment,
    clearAll,
    addPastedAttachment,
  } = useAttachment();

  const {
    width: screenWidth,
    height: screenHeight,
    composerBottom,
    gridWidth,
    gridHeight,
    sheetTop,
    menuMaxBottom,
  } = useSheetGeometry();

  const handleSelectFiles = useCallback(() => {
    pickDocument().catch((error) => {
      console.error('Failed to open the document picker:', error);
    });
  }, [pickDocument]);

  const showImagesUnsupportedToast = useCallback(() => {
    Toast.show({
      type: 'defaultToast',
      text1: 'This model does not support images',
    });
  }, []);

  const panel = useAttachmentPanel({
    onSelectFiles: handleSelectFiles,
    canAttachImages: isVisionModel,
    onImagesUnsupported: showImagesUnsupportedToast,
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

  const defaultBarHeight = useRef(0);
  const prevBarHeight = useRef(0);

  // Inset the baseline was captured with. Checked in the layout handler, not
  // an effect: onLayout fires first, so an effect-driven reset would lose the
  // pass carrying the new height.
  const baselineInset = useRef<number | null>(null);
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

  const handleBarLayoutForPadding = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const height = e.nativeEvent.layout.height;
      const inset = theme.insets.bottom;
      // Only capture the default height once we're in the "with messages"
      // layout — otherwise the empty-state extras (WhatsNewCard, prompt
      // suggestions) would bake into the baseline and squeeze the scroll
      // view once they disappear. Re-capture on inset changes (Android
      // navigation mode, rotation), or the stale baseline reads the difference
      // as "the bar grew".
      const isResting = !userInput && attachments.length === 0;
      if (hasMessages && isResting) {
        if (baselineInset.current !== inset) {
          defaultBarHeight.current = height;
          baselineInset.current = inset;
        } else if (
          defaultBarHeight.current === 0 ||
          height < defaultBarHeight.current
        ) {
          defaultBarHeight.current = height;
        }
      }
      const baseline = defaultBarHeight.current || height;
      const delta = height - baseline;
      extraContentPadding.set(
        withTiming(Math.max(0, delta), {
          duration: BAR_GROW_DURATION,
          easing: BAR_GROW_EASING,
        })
      );
      // Baseline, not live height — consumers must not follow the bar as it
      // grows with typed lines; that is what extraContentPadding is for.
      onHeightChange?.(hasMessages ? baseline : 0);
      const grew = height > prevBarHeight.current;
      prevBarHeight.current = height;
      if (delta > 0 && grew) {
        onBarGrow?.();
      }
    },
    [
      attachments.length,
      extraContentPadding,
      onBarGrow,
      onHeightChange,
      hasMessages,
      theme.insets.bottom,
      userInput,
    ]
  );

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

  // The grid and the camera preview are real memory pressure next to a resident
  // model, so the model steps aside as a sheet opens — not as the menu does,
  // which costs nothing.
  const sheetOpen = panel.mode === 'photos' || panel.mode === 'camera';
  const offloadedForSheet = useRef(false);
  useEffect(() => {
    if (sheetOpen) {
      offloadedForSheet.current = true;
      runWithModelOffloaded(async () => {}, { restore: false }).catch(
        (error) => {
          console.error(
            'Failed to offload model before the photo sheet:',
            error
          );
        }
      );
      return;
    }
    // And it has to come back by itself. The keyboard never drops through this
    // flow, so the field is never re-focused and `onFocus` — the only other
    // thing that loads the model — never fires again; a send would find no
    // model and fail with nothing on screen.
    if (!offloadedForSheet.current) return;
    offloadedForSheet.current = false;
    loadSelectedModel().catch((error) => {
      console.error('Failed to reload the model after the photo sheet:', error);
    });
  }, [sheetOpen, runWithModelOffloaded, loadSelectedModel]);

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
    // No `Keyboard.dismiss()`: the panel is anchored to the keyboard and is
    // hosted in the window above it, so the keyboard stays up throughout.
    panel.onPlusPress();
  }, [modelSwitching, panel, showModelSwitchingToast]);

  const handleSend = useCallback(() => {
    if (modelSwitching) {
      showModelSwitchingToast();
      return;
    }
    if (hasLoadingAttachment || disabled) return;
    const attachmentsToSend = attachments;
    const imageUriToSend = imageAttachment?.uri;
    const inputToSend = userInput;

    if (Platform.OS === 'ios') {
      textInputRef.current?.blur();
      setIosInputKey((key) => key + 1);
    }
    setUserInput('');
    clearAll({ cleanupSources: false });
    Promise.resolve(
      onSend(inputToSend, imageUriToSend, attachmentsToSend)
    ).catch((error) => {
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
                    onChangeText={setUserInput}
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
              />
            </View>
          </View>
          <AttachmentOverlay
            panel={panel}
            width={screenWidth}
            height={screenHeight}
            gridWidth={gridWidth}
            gridHeight={gridHeight}
            menuMaxBottom={menuMaxBottom}
            sheetTop={sheetTop}
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
            onDismiss={markDownloadSheetClosed}
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
  });
