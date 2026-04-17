import React, {
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
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import MessageItem from './MessageItem';
import { Message } from '../../database/chatRepository';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import ChevronDown from '../../assets/icons/chevron-down.svg';

export interface MessagesHandle {
  onMessageSent: () => void;
  scrollToEnd: () => void;
}

interface Props {
  chatHistory: Message[];
  extraContentPadding: SharedValue<number>;
  blankSpace: SharedValue<number>;
  /** Whether the LLM is currently streaming a response. */
  isGenerating: boolean;
  /**
   * Distance between the bottom of the screen and the scroll view
   * (ChatBar height + safe area). Passed to KeyboardChatScrollView's
   * offset prop so it correctly calculates the keyboard push distance
   * and doesn't overshoot on keyboard dismiss.
   */
  bottomOffset: number;
  /**
   * Freeze the scroll layout while an overlay (bottom sheet, attachment
   * picker, etc.) is presented, to prevent content jumps when the keyboard
   * is dismissed to make room for the sheet.
   */
  freeze?: boolean;
  ref?: Ref<MessagesHandle>;
}

const Messages = ({
  chatHistory,
  extraContentPadding,
  blankSpace,
  isGenerating,
  bottomOffset,
  freeze = false,
  ref,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollRef = useRef<Reanimated.ScrollView>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const lastScrollOffset = useRef(0);
  const lastLayoutHeight = useRef(0);


  // v0-style initial scroll: hide the view until we've snapped to
  // the bottom, then fade in so the user never sees content flying by.
  // https://vercel.com/blog/how-we-built-the-v0-ios-app
  const opacity = useSharedValue(0);
  const hasScrolledToEnd = useRef(false);
  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
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
      opacity.value = 0;
    }
    prevChatLengthRef.current = chatHistory.length;
  }, [chatHistory.length, opacity]);

  // Heights that drive blankSpace. All in JS refs because updates are
  // driven by layout events and we only need to write the derived value
  // into the shared value once per change.
  const containerHeight = useRef(0);
  const lastUserHeight = useRef(0);
  const lastAssistantHeight = useRef(0);

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
          scrollRef.current?.scrollToEnd({ animated: false });
        }, 300);
      }
    });
    return () => {
      if (snapTimer) clearTimeout(snapTimer);
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // True while the LLM is streaming a response. Gates both the
  // blankSpace formula (recomputeBlankSpace) and the force-scroll
  // in handleContentSizeChange. Flipped off via useLayoutEffect when
  // generation ends, before the stats-row layout event commits.
  const streamingActive = useRef(false);
  // Armed in onMessageSent, consumed on the next onContentSizeChange:
  // seed blankSpace and scroll to end once the new chat row has
  // actually rendered (avoids a 1-frame flick of old content lifted
  // by the new inset).
  const pendingPinRef = useRef(false);

  useLayoutEffect(() => {
    if (!isGenerating) {
      streamingActive.current = false;
    }
  }, [isGenerating]);

  const recomputeBlankSpace = useCallback(() => {
    if (!streamingActive.current) return;
    const CONTAINER_PADDING = 16 + 8;
    const raw = containerHeight.current -
      lastUserHeight.current -
      lastAssistantHeight.current -
      CONTAINER_PADDING;
    const next = raw < 50 ? 0 : raw;
    blankSpace.value = next;
  }, [blankSpace]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToEnd: () => {
        scrollRef.current?.scrollToEnd({ animated: true });
      },
      onMessageSent: () => {
        // Ensure the view is visible (covers new-chat case where the
        // initial-scroll effect hasn't fired because there were no
        // messages yet).
        if (!hasScrolledToEnd.current) {
          hasScrolledToEnd.current = true;
          opacity.value = 1;
        }
        lastAssistantHeight.current = 0;
        lastUserHeight.current = 0;
        streamingActive.current = true;

        if (Platform.OS === 'ios') {
          if (containerHeight.current > 0) {
            blankSpace.value = containerHeight.current;
          }
        }
        pendingPinRef.current = true;
      },
    }),
    [blankSpace, opacity]
  );

  const handleContainerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      containerHeight.current = e.nativeEvent.layout.height;
      recomputeBlankSpace();
    },
    [recomputeBlankSpace]
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
    scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

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
        const snap = () =>
          scrollRef.current?.scrollToEnd({ animated: false });
        snap();
        requestAnimationFrame(() => {
          snap();
          setTimeout(() => {
            snap();
            requestAnimationFrame(() => {
              snap();
              opacity.value = withTiming(1, { duration: 350 });
            });
          }, 16);
        });
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
        if (Platform.OS !== 'ios' && containerHeight.current > 0) {
          blankSpace.value = withTiming(containerHeight.current, {
            duration: 300,
          });
        }
        scrollRef.current?.scrollToEnd({ animated: true });
      }

      // During streaming, check if content has grown past the viewport
      // so the scroll-to-bottom button can appear without the user
      // needing to scroll manually. Use the last known scroll offset
      // (0 if user never scrolled) and the container height as a proxy
      // for the visible area.
      if (containerHeight.current > 0) {
        const layoutH = lastLayoutHeight.current || containerHeight.current;
        const distFromBottom =
          h + blankSpace.value - (lastScrollOffset.current + layoutH);
        const atBottom = distFromBottom < 100;
        if (atBottom !== isAtBottomRef.current) {
          isAtBottomRef.current = atBottom;
          setShowScrollButton(!atBottom);
        }
      }
    },
    [opacity, blankSpace]
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
      keyboardShouldPersistTaps="never"
      contentContainerStyle={styles.contentContainer}
      onLayout={handleContainerLayout}
      onScroll={handleScroll}
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

        const item = (
          <MessageItem
            content={message.content}
            modelName={message.modelName}
            role={message.role}
            tokensPerSecond={message.tokensPerSecond}
            timeToFirstToken={message.timeToFirstToken}
            isLastMessage={isLastMessage}
            imagePath={message.imagePath}
            documentName={message.documentName}
          />
        );

        if (onLayout) {
          return (
            <View key={key} onLayout={onLayout} collapsable={false}>
              {item}
            </View>
          );
        }
        return <React.Fragment key={key}>{item}</React.Fragment>;
      })}
    </KeyboardChatScrollView>

      {showScrollButton && (
        <TouchableOpacity
          style={styles.scrollToBottomButton}
          onPress={scrollToBottom}
          activeOpacity={0.8}
        >
          <ChevronDown
            width={20}
            height={20}
            style={{ color: theme.text.primary }}
          />
        </TouchableOpacity>
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
  });
