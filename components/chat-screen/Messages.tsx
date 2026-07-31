import React, {
  memo,
  ReactNode,
  Ref,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
  useCallback,
  useImperativeHandle,
} from 'react';
import {
  Keyboard,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type View as ViewType,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import Reanimated, {
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import MessageItem from './MessageItem';
import SourcesSheet, { type SourcesSheetHandle } from './SourcesSheet';
import { EdgeFade, FADE_HEIGHT, SEAM_OVERLAP } from './EdgeFade';
import { TopFade, topFadeHeight } from './TopFade';
import {
  Message,
  SourceDocument,
  type ChatBranchMarker,
} from '../../database/chatRepository';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { Feedback } from '../../utils/Feedback';
import ChevronDown from '../../assets/icons/chevron-down.svg';
import RotateLeftIcon from '../../assets/icons/rotate_left.svg';
import BranchMarker from './BranchMarker';
import Toast from 'react-native-toast-message';
import { SUPPORTS_USER_ACTION_MENU } from '../../constants/chat-screen';
import { useKeyboardLift } from './useKeyboardLift';
import { useScrollSettler } from './useScrollSettler';
import { visibleMessageText } from '../../utils/messageText';

/**
 * Height of the opaque system navigation bar the list paints behind. Android
 * only — iOS's bottom inset is the home indicator, a thin overlay that must
 * not be blocked out.
 */
const navBarInset = (theme: Theme) =>
  Platform.OS === 'android' ? theme.insets.bottom : 0;

const BOTTOM_FADE_HEIGHT = Platform.OS === 'ios' ? 64 : FADE_HEIGHT;

/** Right-edge gap so the bottom fade doesn't paint over the scroll indicator. */
const SCROLL_INDICATOR_GUTTER = 12;

const GENERATION_ERROR_MEASUREMENT_KEY = 'generation-error';

const MESSAGE_PIN_OFFSET = 8;

const PIN_FALLBACK_MS = 300;

export interface MessagesHandle {
  onMessageSent: () => void;
  scrollToEnd: () => void;
  scrollToEndIfAtBottom: () => void;
}

export type UserMessageActionMenuState = {
  isOpen: boolean;
  anchor?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  onCopy?: () => void;
};

interface Props {
  chatHistory: Message[];
  extraContentPadding: SharedValue<number>;
  blankSpace: SharedValue<number>;
  /** Whether the LLM is currently streaming a response. */
  isGenerating: boolean;
  generationError?: string;
  onRetryGeneration?: () => void;
  /**
   * Bottom inset forwarded to KeyboardChatScrollView's `offset`. Only the
   * safe-area inset stays fixed below the scroll view while the keyboard
   * animates, because the ChatBar is pinned to the keyboard and rises with it.
   * Using the full ChatBar height under-pads the list and clips the end of
   * long messages.
   */
  bottomOffset: number;
  /**
   * Freeze the scroll layout while an overlay (bottom sheet, attachment
   * picker, etc.) is presented, to prevent content jumps when the keyboard
   * is dismissed to make room for the sheet.
   */
  freeze?: boolean;
  /**
   * Height of the chat bar overlaying the bottom of the list. The scroll view
   * runs full-screen so messages slide under the bar; this keeps the last
   * message resting above it, and sizes the bottom fade.
   */
  chatBarInset: number;
  /**
   * Height of the transparent navigation header (incl. status bar) the list
   * scrolls beneath.
   */
  topInset: number;
  /**
   * Bottom edge of the header's title block, in this component's coordinate
   * space — the top fade's ramp begins there.
   */
  fadeBottom?: number;
  revealFromTop?: boolean;
  branchMarkers?: ChatBranchMarker[];
  onForkMessage?: (message: Message) => void;
  onBranchMarkerPress?: (marker: ChatBranchMarker) => void;
  onUserActionMenuChange?: (menu: UserMessageActionMenuState) => void;
  ref?: Ref<MessagesHandle>;
}

interface MessageActionsState {
  showActions: boolean;
  showForkAction: boolean;
}

interface LongPressableMessageProps {
  children: ReactNode;
  messageId: number;
  onLongPress: (messageId: number, target: ViewType | null) => void;
}

const LongPressableMessage = memo(
  ({ children, messageId, onLongPress }: LongPressableMessageProps) => {
    const targetRef = useRef<ViewType>(null);
    const handleLongPress = useCallback(() => {
      onLongPress(messageId, targetRef.current);
    }, [messageId, onLongPress]);

    const longPressGesture = useMemo(
      () =>
        Gesture.LongPress()
          .minDuration(450)
          .onStart(() => {
            runOnJS(handleLongPress)();
          }),
      [handleLongPress]
    );

    return (
      <GestureDetector gesture={longPressGesture}>
        <View ref={targetRef} collapsable={false}>
          {children}
        </View>
      </GestureDetector>
    );
  }
);

const Messages = ({
  chatHistory,
  extraContentPadding,
  blankSpace,
  isGenerating,
  generationError,
  onRetryGeneration,
  bottomOffset,
  freeze = false,
  chatBarInset,
  topInset,
  fadeBottom,
  revealFromTop = false,
  branchMarkers = [],
  onForkMessage,
  onBranchMarkerPress,
  onUserActionMenuChange,
  ref,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const scrollRef = useRef<Reanimated.ScrollView>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [activeUserActionsId, setActiveUserActionsId] = useState<number | null>(
    null
  );
  const lastScrollOffset = useRef(0);
  const lastLayoutHeight = useRef(0);
  const sourcesSheetRef = useRef<SourcesSheetHandle>(null);

  const handleShowSources = useCallback(
    (sources: SourceDocument[], question?: string) =>
      sourcesSheetRef.current?.present(sources, question),
    []
  );

  // v0-style initial scroll: hide the view until we've snapped to
  // the bottom, then fade in so the user never sees content flying by.
  // https://vercel.com/blog/how-we-built-the-v0-ios-app
  const opacity = useSharedValue(0);
  const revealTranslateY = useSharedValue(revealFromTop ? -28 : 0);
  const hasScrolledToEnd = useRef(false);
  const initialScrollSettlingUntil = useRef(0);
  const initialScrollTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: revealTranslateY.get() }],
  }));

  const clearInitialScrollTimers = useCallback(() => {
    initialScrollTimers.current.forEach(clearTimeout);
    initialScrollTimers.current = [];
  }, []);

  const snapToEnd = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, []);

  const {
    start: startPin,
    cancel: cancelPin,
    resettle: resettlePin,
    isSettling: isPinSettling,
  } = useScrollSettler(
    useCallback((animated: boolean) => {
      scrollRef.current?.scrollToEnd({ animated });
    }, [])
  );

  const scheduleInitialScrollToEnd = useCallback(() => {
    clearInitialScrollTimers();
    snapToEnd();

    const schedule = (delay: number, action: () => void) => {
      const timer = setTimeout(action, delay);
      initialScrollTimers.current.push(timer);
    };

    [16, 50, 100, 180, 300, 450].forEach((delay) => {
      schedule(delay, () => {
        snapToEnd();
      });
    });

    schedule(500, () => {
      snapToEnd();
      opacity.set(withTiming(1, { duration: 350 }));
      revealTranslateY.set(withTiming(0, { duration: 350 }));
      initialScrollTimers.current = [];
    });
  }, [clearInitialScrollTimers, opacity, revealTranslateY, snapToEnd]);

  const latestBranchMarkerByMessageId = useMemo(() => {
    const byMessageId = new Map<number, ChatBranchMarker>();
    for (const marker of branchMarkers) {
      const current = byMessageId.get(marker.afterMessageId);
      if (!current || marker.id > current.id) {
        byMessageId.set(marker.afterMessageId, marker);
      }
    }
    return byMessageId;
  }, [branchMarkers]);

  const keyboardLift = useKeyboardLift();
  const scrollButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -extraContentPadding.value + keyboardLift.value },
    ],
  }));

  const listTopPadding = topInset + 16;
  const listBottomPadding = chatBarInset + 8;
  const contentContainerStyle = useMemo(
    () => [
      styles.contentContainer,
      { paddingTop: listTopPadding, paddingBottom: listBottomPadding },
    ],
    [styles.contentContainer, listBottomPadding, listTopPadding]
  );
  const fadeAnchor = fadeBottom ?? topInset;
  const scrollIndicatorInsets = useMemo(
    () => ({ top: topFadeHeight(fadeAnchor) }),
    [fadeAnchor]
  );
  const scrollButtonStyle = useMemo(
    () => [styles.scrollToBottomButtonContainer, { bottom: chatBarInset + 16 }],
    [styles.scrollToBottomButtonContainer, chatBarInset]
  );

  const bottomFadeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboardLift.value }],
  }));

  // Re-arm the initial scroll when the chat history is cleared (e.g.
  // navigating away via useFocusEffect in the chat route sets
  // messageHistory to [] while reloading). This ensures that returning
  // from Settings lands at the bottom of the chat instead of the top.
  const prevChatLengthRef = useRef(chatHistory.length);
  useLayoutEffect(() => {
    if (
      prevChatLengthRef.current > 0 &&
      chatHistory.length === 0 &&
      hasScrolledToEnd.current
    ) {
      hasScrolledToEnd.current = false;
      opacity.set(0);
      pinActive.current = false;
      blankSpace.set(0);
      cancelPin();
    }
    prevChatLengthRef.current = chatHistory.length;
  }, [chatHistory.length, opacity, blankSpace, cancelPin]);

  useLayoutEffect(() => clearInitialScrollTimers, [clearInitialScrollTimers]);

  // Heights that drive blankSpace. All in JS refs because updates are
  // driven by layout events and we only need to write the derived value
  // into the shared value once per change.
  const containerHeight = useRef(0);
  const lastUserHeight = useRef(0);
  const lastAssistantHeight = useRef(0);
  const lastUserMeasurementKey = useRef<string | null>(null);
  const lastAssistantMeasurementKey = useRef<string | null>(null);

  const closeUserActionMenu = useCallback(() => {
    setActiveUserActionsId(null);
    onUserActionMenuChange?.({ isOpen: false });
  }, [onUserActionMenuChange]);

  const pendingMenuOpenRef = useRef<(() => void) | null>(null);

  // Android-only: KeyboardChatScrollView's ClippingScrollView can
  // bounce the scroll offset on keyboard dismiss. Snap back to the
  // remembered position (top or bottom) if the user hadn't manually
  // scrolled while the keyboard was open. iOS handles this natively.
  const wasAtBottomDuringKeyboard = useRef(false);
  const keyboardOpenRef = useRef(false);
  const userScrolledDuringKeyboard = useRef(false);
  useLayoutEffect(() => {
    if (Platform.OS !== 'android') return;
    let snapTimer: ReturnType<typeof setTimeout> | null = null;
    let firstFrame: number | null = null;
    let secondFrame: number | null = null;

    const clearPendingSnap = () => {
      if (snapTimer) {
        clearTimeout(snapTimer);
        snapTimer = null;
      }
      if (firstFrame !== null) {
        cancelAnimationFrame(firstFrame);
        firstFrame = null;
      }
      if (secondFrame !== null) {
        cancelAnimationFrame(secondFrame);
        secondFrame = null;
      }
    };

    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      clearPendingSnap();
      keyboardOpenRef.current = true;
      wasAtBottomDuringKeyboard.current = isAtBottomRef.current;
      userScrolledDuringKeyboard.current = false;
      closeUserActionMenu();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardOpenRef.current = false;
      const runPendingMenuOpen = () => {
        const openMenu = pendingMenuOpenRef.current;
        pendingMenuOpenRef.current = null;
        openMenu?.();
      };

      if (
        (wasAtBottomDuringKeyboard.current &&
          !userScrolledDuringKeyboard.current) ||
        isPinSettling()
      ) {
        clearPendingSnap();
        firstFrame = requestAnimationFrame(() => {
          secondFrame = requestAnimationFrame(() => {
            closeUserActionMenu();
            scrollRef.current?.scrollToEnd({ animated: false });
          });
        });
        snapTimer = setTimeout(() => {
          closeUserActionMenu();
          scrollRef.current?.scrollToEnd({ animated: false });
          runPendingMenuOpen();
        }, 160);
        return;
      }

      runPendingMenuOpen();
    });
    return () => {
      clearPendingSnap();
      showSub.remove();
      hideSub.remove();
    };
  }, [closeUserActionMenu, isPinSettling]);

  // Armed from onMessageSent until the chat is cleared; gates recomputeBlankSpace.
  // Stays armed past end-of-stream so the final layout (once the stats row and
  // Copy/Fork bar commit) recomputes blankSpace with the assistant's true height,
  // instead of leaving it ~50px too large — which clips the pinned question.
  const pinActive = useRef(false);
  // Armed in onMessageSent, consumed on the next onContentSizeChange:
  // seed blankSpace and scroll to end once the new chat row has
  // actually rendered (avoids a 1-frame flick of old content lifted
  // by the new inset).
  const pendingPinRef = useRef(false);

  const recomputeBlankSpace = useCallback(() => {
    if (!pinActive.current) return;
    const raw =
      containerHeight.current -
      lastUserHeight.current -
      lastAssistantHeight.current -
      listTopPadding -
      listBottomPadding +
      MESSAGE_PIN_OFFSET;
    blankSpace.set(Math.max(0, raw));
    resettlePin();
  }, [blankSpace, listBottomPadding, listTopPadding, resettlePin]);

  const pinFallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPinFallback = useCallback(() => {
    if (pinFallbackTimer.current) {
      clearTimeout(pinFallbackTimer.current);
      pinFallbackTimer.current = null;
    }
  }, []);

  const runPendingPin = useCallback(() => {
    if (!pendingPinRef.current) return;
    pendingPinRef.current = false;
    clearPinFallback();
    closeUserActionMenu();
    if (Platform.OS !== 'ios' && containerHeight.current > 0) {
      blankSpace.set(containerHeight.current - topInset + MESSAGE_PIN_OFFSET);
    }
    startPin();
  }, [blankSpace, clearPinFallback, closeUserActionMenu, startPin, topInset]);

  useLayoutEffect(() => clearPinFallback, [clearPinFallback]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToEnd: () => {
        closeUserActionMenu();
        scrollRef.current?.scrollToEnd({ animated: true });
      },
      scrollToEndIfAtBottom: () => {
        if (isAtBottomRef.current) {
          scrollRef.current?.scrollToEnd({ animated: true });
        }
      },
      onMessageSent: () => {
        closeUserActionMenu();
        // Ensure the view is visible (covers new-chat case where the
        // initial-scroll effect hasn't fired because there were no
        // messages yet).
        if (!hasScrolledToEnd.current) {
          hasScrolledToEnd.current = true;
          opacity.set(1);
        }
        lastAssistantHeight.current = 0;
        lastUserHeight.current = 0;
        pinActive.current = true;

        if (Platform.OS === 'ios') {
          if (containerHeight.current > 0) {
            blankSpace.set(containerHeight.current - topInset);
          }
        }
        pendingPinRef.current = true;
        clearPinFallback();
        pinFallbackTimer.current = setTimeout(runPendingPin, PIN_FALLBACK_MS);
      },
    }),
    [
      blankSpace,
      clearPinFallback,
      closeUserActionMenu,
      opacity,
      runPendingPin,
      topInset,
    ]
  );

  const handleContainerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      containerHeight.current = e.nativeEvent.layout.height;
      lastLayoutHeight.current = e.nativeEvent.layout.height;
      recomputeBlankSpace();
      if (Date.now() < initialScrollSettlingUntil.current) {
        snapToEnd();
      }
    },
    [recomputeBlankSpace, snapToEnd]
  );

  const handleLastUserLayout = useCallback(
    (key: string, e: LayoutChangeEvent) => {
      if (lastUserMeasurementKey.current !== key) return;
      lastUserHeight.current = e.nativeEvent.layout.height;
      recomputeBlankSpace();
    },
    [recomputeBlankSpace]
  );

  const handleLastAssistantLayout = useCallback(
    (key: string, e: LayoutChangeEvent) => {
      if (lastAssistantMeasurementKey.current !== key) return;
      lastAssistantHeight.current = e.nativeEvent.layout.height;
      recomputeBlankSpace();
    },
    [recomputeBlankSpace]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement, contentInset } =
        event.nativeEvent;
      lastScrollOffset.current = contentOffset.y;
      lastLayoutHeight.current = layoutMeasurement.height;
      const bottomInset = contentInset?.bottom ?? 0;
      const distanceFromBottom =
        contentSize.height +
        bottomInset -
        (contentOffset.y + layoutMeasurement.height);
      const atBottom = distanceFromBottom < 100;
      isAtBottomRef.current = atBottom;
      setShowScrollButton(!atBottom);
    },
    []
  );

  const scrollToBottom = useCallback(() => {
    closeUserActionMenu();
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [closeUserActionMenu]);

  const handleCopyMessage = useCallback(
    async (message: Message) => {
      await Clipboard.setStringAsync(visibleMessageText(message));
      if (message.role === 'user') {
        closeUserActionMenu();
      }
      Toast.show({
        type: 'defaultToast',
        text1: 'Message copied',
      });
    },
    [closeUserActionMenu]
  );

  const getMessageActionsState = useCallback(
    (message: Message): MessageActionsState => {
      const isPersisted = message.id > 0;

      if (message.role === 'assistant') {
        return {
          showActions: isPersisted && message.content.trim().length > 0,
          showForkAction: isPersisted && !!onForkMessage && !isGenerating,
        };
      }

      return {
        showActions: false,
        showForkAction: false,
      };
    },
    [isGenerating, onForkMessage]
  );

  const handleUserLongPress = useCallback(
    (messageId: number, target: ViewType | null) => {
      const message = chatHistory.find((item) => item.id === messageId);
      if (!message) return;

      const shouldOpen = activeUserActionsId !== messageId;
      setActiveUserActionsId(shouldOpen ? messageId : null);

      if (!shouldOpen) {
        onUserActionMenuChange?.({ isOpen: false });
        return;
      }

      Feedback.longPress();

      const openMenu = () => {
        target?.measureInWindow((x, y, width, height) => {
          onUserActionMenuChange?.({
            isOpen: true,
            anchor: { x, y, width, height },
            onCopy: () => handleCopyMessage(message),
          });
        });
      };

      if (!Keyboard.isVisible()) {
        openMenu();
        return;
      }

      pendingMenuOpenRef.current = openMenu;
      Keyboard.dismiss();
    },
    [
      activeUserActionsId,
      chatHistory,
      handleCopyMessage,
      onUserActionMenuChange,
    ]
  );

  const handleScrollTouchStart = useCallback(() => {
    if (activeUserActionsId !== null) {
      closeUserActionMenu();
      Keyboard.dismiss();
    }
  }, [activeUserActionsId, closeUserActionMenu]);

  const handleScrollBeginDrag = useCallback(() => {
    if (keyboardOpenRef.current) {
      userScrolledDuringKeyboard.current = true;
    }
    cancelPin();
  }, [cancelPin]);

  const handleForkMessage = useCallback(
    (message: Message) => {
      onForkMessage?.(message);
    },
    [onForkMessage]
  );

  const handleContentSizeChange = useCallback(
    (_w: number, h: number) => {
      // Initial reveal: content has been laid out for the first time.
      // Snap to bottom then fade in. This is the most reliable place to
      // scroll because the native content size is already committed.
      if (!hasScrolledToEnd.current) {
        // The first onContentSizeChange fires with just the paddings, before
        if (h <= listTopPadding + listBottomPadding) return;

        hasScrolledToEnd.current = true;
        initialScrollSettlingUntil.current = Date.now() + 650;
        scheduleInitialScrollToEnd();
        return;
      }

      runPendingPin();

      // During streaming, check if content has grown past the viewport
      // so the scroll-to-bottom button can appear without the user
      // needing to scroll manually. Use the last known scroll offset
      // (0 if user never scrolled) and the container height as a proxy
      // for the visible area. Exclude blankSpace — it's an inflated
      // inset that keeps the new row pinned, not real content, so
      // including it would light up the button before any tokens have
      // actually arrived.
      if (containerHeight.current > 0) {
        const layoutH = lastLayoutHeight.current || containerHeight.current;
        const distFromBottom = h - (lastScrollOffset.current + layoutH);
        const atBottom = distFromBottom < 100;
        if (atBottom !== isAtBottomRef.current) {
          isAtBottomRef.current = atBottom;
          setShowScrollButton(!atBottom);
        }
      }
    },
    [
      listBottomPadding,
      listTopPadding,
      runPendingPin,
      scheduleInitialScrollToEnd,
    ]
  );

  // Citations are highlighted against the preceding user question.
  const questionForAssistantAt = useMemo(() => {
    const questions: (string | undefined)[] = new Array(chatHistory.length);
    let lastUserContent: string | undefined;
    for (let i = 0; i < chatHistory.length; i += 1) {
      const message = chatHistory[i];
      if (message.role === 'user') lastUserContent = message.content;
      questions[i] = message.role === 'assistant' ? lastUserContent : undefined;
    }
    return questions;
  }, [chatHistory]);

  const hasMessages = chatHistory.length > 0;

  // Identify the last user and last assistant indices so we can wrap
  // those specific rows in onLayout measurement Views.
  let lastUserIndex = -1;
  let lastAssistantIndex = -1;
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    if (
      !generationError &&
      lastAssistantIndex === -1 &&
      chatHistory[i].role === 'assistant'
    ) {
      lastAssistantIndex = i;
    }
    if (lastUserIndex === -1 && chatHistory[i].role === 'user') {
      lastUserIndex = i;
    }
    if (lastUserIndex !== -1 && lastAssistantIndex !== -1) break;
  }

  const measurementKeyAt = (index: number): string | null => {
    const message = chatHistory[index];
    if (!message) return null;
    return message.id > 0
      ? `msg-${message.id}`
      : `pending-${message.role}-${index}`;
  };

  const assistantMeasurementKey = (): string | null => {
    if (generationError) return GENERATION_ERROR_MEASUREMENT_KEY;
    return measurementKeyAt(lastAssistantIndex);
  };

  lastUserMeasurementKey.current = measurementKeyAt(lastUserIndex);
  lastAssistantMeasurementKey.current = assistantMeasurementKey();

  return (
    <Reanimated.View style={[styles.container, animatedContainerStyle]}>
      <KeyboardChatScrollView
        ref={scrollRef}
        keyboardLiftBehavior="whenAtEnd"
        offset={bottomOffset}
        extraContentPadding={extraContentPadding}
        blankSpace={blankSpace}
        freeze={freeze}
        applyWorkaroundForContentInsetHitTestBug
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={contentContainerStyle}
        scrollIndicatorInsets={scrollIndicatorInsets}
        onLayout={handleContainerLayout}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onTouchStart={handleScrollTouchStart}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={16}
        style={styles.container}
      >
        {chatHistory.map((message, index) => {
          const isLastMessage = index === chatHistory.length - 1;
          const userQuestion = questionForAssistantAt[index];
          // Streaming assistant placeholder has id: -1 until persisted; fall
          // back to role+index for that single in-flight row.
          const key =
            message.id && message.id > 0
              ? `msg-${message.id}`
              : `pending-${message.role}-${index}`;

          const onLayout =
            index === lastUserIndex
              ? (event: LayoutChangeEvent) => handleLastUserLayout(key, event)
              : index === lastAssistantIndex
                ? (event: LayoutChangeEvent) =>
                    handleLastAssistantLayout(key, event)
                : undefined;
          const branchMarker = latestBranchMarkerByMessageId.get(message.id);
          const { showActions, showForkAction } =
            getMessageActionsState(message);

          const item = (
            <View style={styles.messageRow} collapsable={false}>
              <MessageItem
                message={message}
                content={message.content}
                modelName={message.modelName}
                role={message.role}
                tokensPerSecond={message.tokensPerSecond}
                timeToFirstToken={message.timeToFirstToken}
                isLastMessage={isLastMessage}
                imagePath={message.imagePath}
                documentName={message.documentName}
                sourceDocuments={message.sourceDocuments}
                userQuestion={userQuestion}
                onShowSources={handleShowSources}
                showActions={showActions}
                showForkAction={showForkAction}
                onCopy={handleCopyMessage}
                onFork={handleForkMessage}
              />
              {branchMarker && (
                <BranchMarker
                  key={`branch-${branchMarker.id}`}
                  marker={branchMarker}
                  onPress={onBranchMarkerPress}
                />
              )}
            </View>
          );

          const shouldHandleUserLongPress =
            SUPPORTS_USER_ACTION_MENU &&
            message.role === 'user' &&
            message.id > 0;

          if (onLayout) {
            if (!shouldHandleUserLongPress) {
              return (
                <View key={key} onLayout={onLayout} collapsable={false}>
                  {item}
                </View>
              );
            }

            return (
              <View key={key} onLayout={onLayout} collapsable={false}>
                <LongPressableMessage
                  messageId={message.id}
                  onLongPress={handleUserLongPress}
                >
                  {item}
                </LongPressableMessage>
              </View>
            );
          }

          if (!shouldHandleUserLongPress) {
            return <React.Fragment key={key}>{item}</React.Fragment>;
          }

          return (
            <LongPressableMessage
              key={key}
              messageId={message.id}
              onLongPress={handleUserLongPress}
            >
              {item}
            </LongPressableMessage>
          );
        })}
        {generationError && (
          <View
            onLayout={(event) =>
              handleLastAssistantLayout(GENERATION_ERROR_MEASUREMENT_KEY, event)
            }
            collapsable={false}
            style={styles.generationError}
            testID="generation-error"
          >
            <Text style={styles.generationErrorText}>{generationError}</Text>
            <Pressable
              onPress={onRetryGeneration}
              accessibilityRole="button"
              accessibilityLabel="Retry response generation"
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
              ]}
            >
              <RotateLeftIcon
                width={16}
                height={16}
                style={styles.retryButtonIcon}
              />
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}
      </KeyboardChatScrollView>

      {hasMessages && <TopFade anchor={fadeAnchor} />}
      {hasMessages && (
        <Reanimated.View
          style={[styles.bottomFade, bottomFadeAnimatedStyle]}
          pointerEvents="none"
        >
          <EdgeFade edge="bottom" style={styles.bottomFadeRamp} />
          <View style={styles.bottomFadeSolid} />
        </Reanimated.View>
      )}
      {showScrollButton && (
        <Reanimated.View style={[scrollButtonStyle, scrollButtonAnimatedStyle]}>
          <Pressable
            style={({ pressed }) => [
              styles.scrollToBottomButton,
              pressed && styles.scrollToBottomButtonPressed,
            ]}
            onPress={scrollToBottom}
            accessibilityRole="button"
            accessibilityLabel="Scroll to latest message"
          >
            <ChevronDown
              width={20}
              height={20}
              style={{ color: theme.text.primary }}
            />
          </Pressable>
        </Reanimated.View>
      )}

      <SourcesSheet ref={sourcesSheetRef} />
    </Reanimated.View>
  );
};

export default memo(Messages);

const createStyles = (theme: Theme) => {
  const navInset = navBarInset(theme);
  return StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
    },
    contentContainer: {
      paddingHorizontal: 16,
    },
    bottomFade: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: SCROLL_INDICATOR_GUTTER,
      height: BOTTOM_FADE_HEIGHT + navInset,
    },
    // On Android the ramp must reach full opacity by the top of the navigation
    // bar, or text stays visible sliding under it. insets.bottom carries the
    // gesture-vs-buttons difference, so both modes and rotation follow.
    bottomFadeRamp: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: navInset,
    },
    bottomFadeSolid: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      // Overlaps the ramp: insets.bottom is fractional, so the two edges round
      // independently and leave a sub-pixel seam as a brighter hairline.
      height: navInset && navInset + SEAM_OVERLAP,
      backgroundColor: theme.bg.softPrimary,
    },
    messageRow: {
      position: 'relative',
    },
    generationError: {
      width: '90%',
      alignSelf: 'flex-start',
      marginBottom: 24,
      gap: 8,
    },
    generationErrorText: {
      color: theme.text.defaultSecondary,
      fontSize: 14,
    },
    retryButton: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 8,
      backgroundColor: theme.bg.softSecondary,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    retryButtonPressed: {
      opacity: 0.7,
    },
    retryButtonIcon: {
      color: theme.text.primary,
    },
    retryButtonText: {
      color: theme.text.primary,
      fontSize: 14,
    },
    scrollToBottomButtonContainer: {
      position: 'absolute',
      right: 16,
    },
    scrollToBottomButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.bg.softSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.bg.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    scrollToBottomButtonPressed: {
      opacity: 0.8,
    },
  });
};
