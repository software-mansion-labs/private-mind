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
import { Message, type ChatBranchMarker } from '../../database/chatRepository';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { Feedback } from '../../utils/Feedback';
import ChevronDown from '../../assets/icons/chevron-down.svg';
import BranchMarker from './BranchMarker';
import Toast from 'react-native-toast-message';

export interface MessagesHandle {
  onMessageSent: () => void;
  scrollToEnd: () => void;
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
  bottomOffset,
  freeze = false,
  revealFromTop = false,
  branchMarkers = [],
  onForkMessage,
  onBranchMarkerPress,
  onUserActionMenuChange,
  ref,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollRef = useRef<Reanimated.ScrollView>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [activeUserActionsId, setActiveUserActionsId] = useState<number | null>(
    null
  );
  const lastScrollOffset = useRef(0);
  const lastLayoutHeight = useRef(0);

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
    }
    prevChatLengthRef.current = chatHistory.length;
  }, [chatHistory.length, opacity, blankSpace]);

  useLayoutEffect(() => clearInitialScrollTimers, [clearInitialScrollTimers]);

  // Heights that drive blankSpace. All in JS refs because updates are
  // driven by layout events and we only need to write the derived value
  // into the shared value once per change.
  const containerHeight = useRef(0);
  const lastUserHeight = useRef(0);
  const lastAssistantHeight = useRef(0);

  const closeUserActionMenu = useCallback(() => {
    setActiveUserActionsId(null);
    onUserActionMenuChange?.({ isOpen: false });
  }, [onUserActionMenuChange]);

  // Android-only: KeyboardChatScrollView's ClippingScrollView can
  // bounce the scroll offset on keyboard dismiss. Snap back to the
  // remembered position (top or bottom) if the user hadn't manually
  // scrolled while the keyboard was open. iOS handles this natively.
  const wasAtBottomDuringKeyboard = useRef(false);
  useLayoutEffect(() => {
    if (Platform.OS !== 'android') return;
    let snapTimer: ReturnType<typeof setTimeout> | null = null;
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      wasAtBottomDuringKeyboard.current = isAtBottomRef.current;
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      if (wasAtBottomDuringKeyboard.current) {
        snapTimer = setTimeout(() => {
          closeUserActionMenu();
          scrollRef.current?.scrollToEnd({ animated: false });
        }, 300);
      }
    });
    return () => {
      if (snapTimer) clearTimeout(snapTimer);
      showSub.remove();
      hideSub.remove();
    };
  }, [closeUserActionMenu]);

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
    const CONTAINER_PADDING = 16 + 8;
    const raw =
      containerHeight.current -
      lastUserHeight.current -
      lastAssistantHeight.current -
      CONTAINER_PADDING;
    blankSpace.set(Math.max(0, raw));
  }, [blankSpace]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToEnd: () => {
        closeUserActionMenu();
        scrollRef.current?.scrollToEnd({ animated: true });
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
            blankSpace.set(containerHeight.current);
          }
        }
        pendingPinRef.current = true;
      },
    }),
    [blankSpace, closeUserActionMenu, opacity]
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
    (e: LayoutChangeEvent) => {
      lastUserHeight.current = e.nativeEvent.layout.height;
      recomputeBlankSpace();
    },
    [recomputeBlankSpace]
  );

  const handleLastAssistantLayout = useCallback(
    (e: LayoutChangeEvent) => {
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
      await Clipboard.setStringAsync(message.content);
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
    (message: Message, isLastMessage: boolean): MessageActionsState => {
      const isPersisted = message.id > 0;
      const isStreamingMessage = isLastMessage && isGenerating;

      if (message.role === 'assistant') {
        return {
          showActions: isPersisted && message.content.trim().length > 0,
          showForkAction: isPersisted && !!onForkMessage && !isStreamingMessage,
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

      if (shouldOpen) {
        Feedback.longPress();
        target?.measureInWindow((x, y, width, height) => {
          onUserActionMenuChange?.({
            isOpen: true,
            anchor: { x, y, width, height },
            onCopy: () => handleCopyMessage(message),
          });
        });
      } else {
        onUserActionMenuChange?.({ isOpen: false });
      }
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
        // Wait until messages have actually rendered — the first
        // onContentSizeChange fires with just padding (~24px) before
        // the message items have laid out. Scrolling at that point is
        // a no-op since there's nothing to scroll to.
        const CONTENT_PADDING = 24;
        if (h <= CONTENT_PADDING) return;

        hasScrolledToEnd.current = true;
        initialScrollSettlingUntil.current = Date.now() + 650;
        scheduleInitialScrollToEnd();
        return;
      }

      // After send: now that the new chat row has rendered, seed
      // blankSpace and scroll to end. Doing this here (instead of
      // synchronously in onMessageSent) avoids a 1-frame flick where
      // the old content gets lifted by the new inset before the new
      // DOM commits.
      // Android: defer the pin here (not in onMessageSent) so the new
      // row has committed before we expand blankSpace. Animate both
      // blankSpace and scrollToEnd for a smooth transition.
      if (pendingPinRef.current) {
        pendingPinRef.current = false;
        closeUserActionMenu();
        if (Platform.OS !== 'ios' && containerHeight.current > 0) {
          blankSpace.set(
            withTiming(containerHeight.current, {
              duration: 300,
            })
          );
        }
        scrollRef.current?.scrollToEnd({ animated: true });
      }

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
    [blankSpace, closeUserActionMenu, scheduleInitialScrollToEnd]
  );

  // Identify the last user and last assistant indices so we can wrap
  // those specific rows in onLayout measurement Views.
  let lastUserIndex = -1;
  let lastAssistantIndex = -1;
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    if (lastAssistantIndex === -1 && chatHistory[i].role === 'assistant') {
      lastAssistantIndex = i;
    }
    if (lastUserIndex === -1 && chatHistory[i].role === 'user') {
      lastUserIndex = i;
    }
    if (lastUserIndex !== -1 && lastAssistantIndex !== -1) break;
  }

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
        contentContainerStyle={styles.contentContainer}
        onLayout={handleContainerLayout}
        onScroll={handleScroll}
        onTouchStart={handleScrollTouchStart}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={16}
        style={styles.container}
      >
        {chatHistory.map((message, index) => {
          const isLastMessage = index === chatHistory.length - 1;
          // Streaming assistant placeholder has id: -1 until persisted; fall
          // back to role+index for that single in-flight row.
          const key =
            message.id && message.id > 0
              ? `msg-${message.id}`
              : `pending-${message.role}-${index}`;

          const onLayout =
            index === lastUserIndex
              ? handleLastUserLayout
              : index === lastAssistantIndex
                ? handleLastAssistantLayout
                : undefined;
          const branchMarker = latestBranchMarkerByMessageId.get(message.id);
          const { showActions, showForkAction } = getMessageActionsState(
            message,
            isLastMessage
          );

          const item = (
            <View style={styles.messageRow} collapsable={false}>
              <MessageItem
                content={message.content}
                modelName={message.modelName}
                role={message.role}
                tokensPerSecond={message.tokensPerSecond}
                timeToFirstToken={message.timeToFirstToken}
                isLastMessage={isLastMessage}
                imagePath={message.imagePath}
                documentName={message.documentName}
                showActions={showActions}
                showForkAction={showForkAction}
                onCopy={() => handleCopyMessage(message)}
                onFork={() => handleForkMessage(message)}
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
            message.role === 'user' &&
            message.id > 0 &&
            activeUserActionsId !== message.id;

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
      </KeyboardChatScrollView>

      {showScrollButton && (
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
      )}
    </Reanimated.View>
  );
};

export default Messages;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
    },
    contentContainer: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    messageRow: {
      position: 'relative',
    },
    scrollToBottomButton: {
      position: 'absolute',
      bottom: 16,
      right: 16,
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
