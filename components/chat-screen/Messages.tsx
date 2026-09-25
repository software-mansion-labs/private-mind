import React, {
  memo,
  ReactNode,
  Ref,
  useEffect,
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
  useAnimatedReaction,
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import MessageItem from './MessageItem';
import SourcesSheet, { type SourcesSheetHandle } from './SourcesSheet';
import { EdgeFade } from './EdgeFade';
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
import {
  BOTTOM_FADE_HEIGHT,
  GENERATION_ERROR_MEASUREMENT_KEY,
  MESSAGE_PIN_OFFSET,
  MESSAGE_PIN_SETTLE_MS,
  navBarInset,
  REVEAL_FALLBACK_MS,
  SCROLL_INDICATOR_GUTTER,
  SEAM_OVERLAP,
  SUPPORTS_USER_ACTION_MENU,
} from '../../constants/chat-screen';
import { messageRowKey } from '../../utils/messageRowKey';
import { useKeyboardLift } from './useKeyboardLift';
import { useKeyboardOwnerStore } from '../../store/keyboardOwnerStore';
import { useSendKeyboardFreeze } from './useSendKeyboardFreeze';
import {
  atListEnd,
  floorIsOffscreen,
  floorIsOutgrown,
  pinFloorFor,
  pinLandedShort,
  pinTargetReachable,
  pinReleaseTarget,
} from './pinScroll';
import { visibleMessageText } from '../../utils/messageText';

export interface MessagesHandle {
  onMessageSent: () => void;
  cancelMessageSent: () => void;
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
  forkDisabled: boolean;
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
  const [revealed, setRevealed] = useState(false);
  const revealSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleReveal = useCallback((afterMs: number) => {
    if (revealSettleTimer.current) clearTimeout(revealSettleTimer.current);
    revealSettleTimer.current = setTimeout(() => setRevealed(true), afterMs);
  }, []);
  const unsettleReveal = useCallback(() => {
    if (revealSettleTimer.current) clearTimeout(revealSettleTimer.current);
    revealSettleTimer.current = null;
    setRevealed(false);
  }, []);
  useEffect(
    () => () => {
      if (revealSettleTimer.current) clearTimeout(revealSettleTimer.current);
    },
    []
  );
  const hasScrolledToEnd = useRef(false);
  const contentHeight = useRef(0);
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

    const reveal = (duration: number) => {
      clearInitialScrollTimers();
      snapToEnd();
      opacity.set(withTiming(1, { duration }));
      revealTranslateY.set(withTiming(0, { duration }));
      settleReveal(duration);
    };

    let settledHeight = -1;
    let settledRounds = 0;
    [16, 50, 100, 180, 300, 450].forEach((delay) => {
      schedule(delay, () => {
        snapToEnd();
        if (contentHeight.current === settledHeight) {
          settledRounds += 1;
          if (settledRounds >= 2) reveal(200);
          return;
        }
        settledHeight = contentHeight.current;
        settledRounds = 0;
      });
    });

    schedule(500, () => reveal(350));
  }, [
    clearInitialScrollTimers,
    opacity,
    revealTranslateY,
    settleReveal,
    snapToEnd,
  ]);

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
  const modalOwnsKeyboard = useKeyboardOwnerStore(
    (state) => state.modalOwnsKeyboard
  );
  const {
    frozen: sendFrozen,
    arm: freezeForSend,
    release: releaseSendFreeze,
  } = useSendKeyboardFreeze(keyboardLift, extraContentPadding);
  const scrollFreeze = useDerivedValue(
    () => freeze || sendFrozen.value,
    [freeze]
  );
  const scrollButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -extraContentPadding.value + keyboardLift.value },
    ],
  }));

  const listTopPadding = topInset + 16;
  const listBottomPadding = chatBarInset + 8;
  const listPaddingRef = useRef({
    top: listTopPadding,
    bottom: listBottomPadding,
  });
  listPaddingRef.current = { top: listTopPadding, bottom: listBottomPadding };
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
    const prevChatLength = prevChatLengthRef.current;
    prevChatLengthRef.current = chatHistory.length;

    const sendInFlight = pendingPinRef.current || pinActive.current;
    if (
      prevChatLength > 0 &&
      chatHistory.length === 0 &&
      hasScrolledToEnd.current &&
      !sendInFlight
    ) {
      hasScrolledToEnd.current = false;
      opacity.set(0);
      unsettleReveal();
      pinActive.current = false;
      pinPlacementPendingRef.current = false;
      pinHoldRef.current = false;
      pinReleaseRef.current = false;
      setPinAnchor(null);
      return;
    }

    const historyCameBackUnrevealed =
      prevChatLength === 0 &&
      chatHistory.length > 0 &&
      !hasScrolledToEnd.current;
    if (historyCameBackUnrevealed) {
      scheduleInitialScrollToEnd();
    }
  }, [chatHistory.length, opacity, scheduleInitialScrollToEnd, unsettleReveal]);

  useEffect(() => {
    if (chatHistory.length === 0) return;
    const timer = setTimeout(() => {
      if (!hasScrolledToEnd.current) {
        hasScrolledToEnd.current = true;
        snapToEnd();
      }
      opacity.set(withTiming(1, { duration: 350 }));
      revealTranslateY.set(withTiming(0, { duration: 350 }));
      settleReveal(350);
    }, REVEAL_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [chatHistory.length, opacity, revealTranslateY, settleReveal, snapToEnd]);

  useEffect(() => {
    if (chatHistory.length > 0) return;
    const timer = setTimeout(() => {
      opacity.set(withTiming(1, { duration: 350 }));
      revealTranslateY.set(withTiming(0, { duration: 350 }));
      settleReveal(350);
    }, REVEAL_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [chatHistory.length, opacity, revealTranslateY, settleReveal]);

  useLayoutEffect(() => clearInitialScrollTimers, [clearInitialScrollTimers]);

  const containerHeight = useRef(0);
  const lastUserHeight = useRef(0);
  const lastAssistantHeight = useRef(0);
  const lastUserTop = useRef(0);
  const lastUserMeasurementKey = useRef<string | null>(null);
  const lastAssistantMeasurementKey = useRef<string | null>(null);

  const closeUserActionMenu = useCallback(() => {
    setActiveUserActionsId(null);
    onUserActionMenuChange?.({ isOpen: false });
  }, [onUserActionMenuChange]);

  const pendingMenuOpenRef = useRef<(() => void) | null>(null);

  const pinActive = useRef(false);
  const pendingPinRef = useRef(false);
  const pinOffset = useRef(0);
  const pinPlacementPendingRef = useRef(false);
  const pinHoldRef = useRef(false);
  const pinLandedSinceKeyboardShow = useRef(false);
  const predictedPinRef = useRef<number | null>(null);

  const clearPinLanding = useCallback(() => {
    pinPlacementPendingRef.current = false;
    pinHoldRef.current = false;
  }, []);

  // The floor under the last answer is what makes the pin offset
  // reachable, so the offset may only be written once that floor is in
  // the tree. Writing it in the same commit is what keeps the question
  // from appearing twice.
  const placePin = useCallback(() => {
    const scrollView = scrollRef.current;
    if (!scrollView) return;
    pinLandedSinceKeyboardShow.current = true;
    scrollView.scrollTo({ y: pinOffset.current, animated: false });
  }, []);

  // The end of the content is inside the space reserved under the
  // answer, so scrolling there would bury the question the pin is
  // still holding at the top.
  const pinStillHolds = useCallback(
    () => pinFloorRef.current > 0 && !pinReleaseRef.current,
    []
  );

  // The keyboard's padding is reconciled only once the send freeze lifts,
  // so a scroll placed during that window can be left pointing at padding
  // rather than at the question.
  const repinAfterFreeze = useCallback(() => {
    if (pendingPinRef.current || pinPlacementPendingRef.current) return;
    if (!pinStillHolds()) return;
    placePin();
  }, [pinStillHolds, placePin]);

  useAnimatedReaction(
    () => sendFrozen.value,
    (isFrozen, wasFrozen) => {
      if (!isFrozen && wasFrozen === true) {
        runOnJS(repinAfterFreeze)();
      }
    }
  );

  const landAfterKeyboard = useCallback(() => {
    if (pinActive.current || pendingPinRef.current) {
      if (!pendingPinRef.current && !pinLandedSinceKeyboardShow.current) {
        placePin();
      }
      return;
    }
    if (pinStillHolds()) {
      placePin();
      return;
    }
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [pinStillHolds, placePin]);

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
      pinLandedSinceKeyboardShow.current = false;
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
        wasAtBottomDuringKeyboard.current &&
        !userScrolledDuringKeyboard.current
      ) {
        clearPendingSnap();
        firstFrame = requestAnimationFrame(() => {
          secondFrame = requestAnimationFrame(() => {
            closeUserActionMenu();
            landAfterKeyboard();
          });
        });
        snapTimer = setTimeout(() => {
          closeUserActionMenu();
          landAfterKeyboard();
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
  }, [closeUserActionMenu, landAfterKeyboard]);

  const [pinAnchor, setPinAnchor] = useState<{
    containerHeight: number;
    userHeight: number;
  } | null>(null);
  const [liftHeldUntilKeyboardHides, setLiftHeldUntilKeyboardHides] =
    useState(false);
  const keyboardLiftBehavior =
    pinAnchor || liftHeldUntilKeyboardHides || modalOwnsKeyboard
      ? 'never'
      : 'whenAtEnd';
  useEffect(() => {
    if (!liftHeldUntilKeyboardHides) return;
    const hidden = Keyboard.addListener('keyboardDidHide', () =>
      setLiftHeldUntilKeyboardHides(false)
    );
    return () => hidden.remove();
  }, [liftHeldUntilKeyboardHides]);
  const pinFloor = pinAnchor
    ? pinFloorFor({
        containerHeight: pinAnchor.containerHeight,
        userHeight: pinAnchor.userHeight,
        listTopPadding,
        listBottomPadding,
      })
    : 0;
  const pinFloorRef = useRef(0);
  pinFloorRef.current = pinFloor;
  const pinFloorStyle = useMemo(
    () => (pinFloor > 0 ? { minHeight: pinFloor } : undefined),
    [pinFloor]
  );

  const applyPendingPin = useCallback(() => {
    if (!pendingPinRef.current || containerHeight.current === 0) return;
    const assistantMeasured =
      lastAssistantMeasurementKey.current === null ||
      lastAssistantHeight.current > 0;
    if (lastUserHeight.current === 0 || !assistantMeasured) return;

    pendingPinRef.current = false;
    closeUserActionMenu();
    // The question's own frame is the only reading that does not move
    // while the answer row below it grows.
    pinOffset.current = Math.max(
      0,
      lastUserTop.current - listPaddingRef.current.top + MESSAGE_PIN_OFFSET
    );
    pinPlacementPendingRef.current = true;
    setPinAnchor({
      containerHeight: containerHeight.current,
      userHeight: lastUserHeight.current,
    });
  }, [closeUserActionMenu]);

  const tryPlacePin = useCallback(() => {
    if (!pinPlacementPendingRef.current) return;
    if (
      !pinTargetReachable({
        contentHeight: contentHeight.current,
        layoutHeight: lastLayoutHeight.current || containerHeight.current,
        target: pinOffset.current,
      })
    ) {
      return;
    }
    placePin();
  }, [placePin]);

  useLayoutEffect(() => {
    if (!pinAnchor || !pinPlacementPendingRef.current) return;
    pinHoldRef.current = true;
    placePin();
  }, [pinAnchor, placePin]);

  useLayoutEffect(() => {
    if (!pendingPinRef.current || predictedPinRef.current === null) return;
    pinOffset.current = predictedPinRef.current;
    predictedPinRef.current = null;
    pinPlacementPendingRef.current = true;
    pinHoldRef.current = true;
    placePin();
  }, [chatHistory.length, placePin]);

  const pinReleaseRef = useRef(false);
  useEffect(() => clearPinLanding, [clearPinLanding]);

  const releaseTarget = useCallback(
    () =>
      pinReleaseTarget({
        contentHeight: contentHeight.current,
        layoutHeight: lastLayoutHeight.current || containerHeight.current,
        floor: pinFloorRef.current,
        rowHeight: lastAssistantHeight.current,
        extraPadding: extraContentPadding.get(),
      }),
    [extraContentPadding]
  );

  const dropPinFloor = useCallback(() => {
    pinReleaseRef.current = false;
    clearPinLanding();
    setPinAnchor(null);
    if (Keyboard.isVisible()) setLiftHeldUntilKeyboardHides(true);
  }, [clearPinLanding]);

  const dropOutgrownFloor = useCallback(() => {
    if (pinActive.current) return;
    if (floorIsOutgrown(pinFloorRef.current, lastAssistantHeight.current)) {
      dropPinFloor();
    }
  }, [dropPinFloor]);

  useEffect(() => {
    if (isGenerating || !pinActive.current) return;
    const timer = setTimeout(() => {
      pinActive.current = false;
      pinHoldRef.current = false;
      dropOutgrownFloor();
    }, MESSAGE_PIN_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [dropOutgrownFloor, isGenerating]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToEnd: () => {
        closeUserActionMenu();
        scrollRef.current?.scrollToEnd({ animated: true });
      },
      scrollToEndIfAtBottom: () => {
        if (!isAtBottomRef.current) return;
        if (pinStillHolds()) {
          placePin();
          return;
        }
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
          settleReveal(0);
        }
        if (!isAtBottomRef.current) {
          isAtBottomRef.current = true;
          setShowScrollButton(false);
        }
        // The question will start where the content currently ends, so the
        // offset is known before the row exists and the scroll does not have
        // to wait for a measurement that costs a painted frame.
        predictedPinRef.current = Math.max(
          0,
          contentHeight.current -
            listPaddingRef.current.bottom -
            Math.max(0, pinFloorRef.current - lastAssistantHeight.current) -
            listPaddingRef.current.top +
            MESSAGE_PIN_OFFSET
        );
        lastAssistantHeight.current = 0;
        lastUserHeight.current = 0;
        pinActive.current = true;
        pinReleaseRef.current = false;
        pendingPinRef.current = true;
        // The room under the answer has to exist before the scroll, or the
        // first scrollTo is clamped by a content size that predates it and
        // the question has to be moved a second time.
        if (containerHeight.current > 0) {
          setPinAnchor({
            containerHeight: containerHeight.current,
            userHeight: 0,
          });
        }
        clearPinLanding();
        freezeForSend();
      },
      cancelMessageSent: () => {
        predictedPinRef.current = null;
        pendingPinRef.current = false;
        pinReleaseRef.current = false;
        pinActive.current = false;
        clearPinLanding();
        releaseSendFreeze();
        setPinAnchor(null);
      },
    }),
    [
      clearPinLanding,
      closeUserActionMenu,
      freezeForSend,
      opacity,
      pinStillHolds,
      placePin,
      releaseSendFreeze,
      settleReveal,
    ]
  );

  const handleContainerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const height = e.nativeEvent.layout.height;
      containerHeight.current = height;
      lastLayoutHeight.current = height;
      setPinAnchor((anchor) =>
        anchor && anchor.containerHeight !== height
          ? { ...anchor, containerHeight: height }
          : anchor
      );
      if (
        !pinActive.current &&
        Date.now() < initialScrollSettlingUntil.current
      ) {
        snapToEnd();
      }
    },
    [snapToEnd]
  );

  const handleLastUserLayout = useCallback(
    (key: string, e: LayoutChangeEvent) => {
      if (lastUserMeasurementKey.current !== key) return;
      lastUserHeight.current = e.nativeEvent.layout.height;
      lastUserTop.current = e.nativeEvent.layout.y;
      applyPendingPin();
    },
    [applyPendingPin]
  );

  const handleLastAssistantLayout = useCallback(
    (key: string, e: LayoutChangeEvent) => {
      if (lastAssistantMeasurementKey.current !== key) return;
      lastAssistantHeight.current = e.nativeEvent.layout.height;
      applyPendingPin();
      dropOutgrownFloor();
    },
    [applyPendingPin, dropOutgrownFloor]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement, contentInset } =
        event.nativeEvent;
      lastScrollOffset.current = contentOffset.y;
      lastLayoutHeight.current = layoutMeasurement.height;
      contentHeight.current = contentSize.height;
      if (pinLandedShort(contentOffset.y, pinOffset.current)) {
        tryPlacePin();
      } else {
        pinPlacementPendingRef.current = false;
      }
      const bottomInset = contentInset?.bottom ?? 0;
      const atBottom = atListEnd({
        offset: contentOffset.y,
        contentHeight: contentSize.height,
        layoutHeight: layoutMeasurement.height,
        bottomInset,
        floorTarget: pinFloorRef.current > 0 ? releaseTarget() : null,
        pinInFlight: pinActive.current || pendingPinRef.current,
      });
      if (atBottom !== isAtBottomRef.current) {
        isAtBottomRef.current = atBottom;
        setShowScrollButton(!atBottom);
      }
      if (
        pinReleaseRef.current &&
        floorIsOffscreen(contentOffset.y, releaseTarget())
      ) {
        dropPinFloor();
      }
    },
    [dropPinFloor, releaseTarget, tryPlacePin]
  );

  const scrollToBottom = useCallback(() => {
    closeUserActionMenu();
    clearPinLanding();
    if (!pinActive.current && pinAnchor && !Keyboard.isVisible()) {
      pinReleaseRef.current = true;
      scrollRef.current?.scrollTo({ y: releaseTarget(), animated: true });
      return;
    }
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [clearPinLanding, closeUserActionMenu, pinAnchor, releaseTarget]);

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
          showForkAction: isPersisted && !!onForkMessage,
          forkDisabled: isGenerating,
        };
      }

      return {
        showActions: false,
        showForkAction: false,
        forkDisabled: false,
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

  const touchScrolledRef = useRef(false);

  const handleScrollTouchStart = useCallback(() => {
    touchScrolledRef.current = false;
    if (activeUserActionsId !== null) {
      closeUserActionMenu();
    }
  }, [activeUserActionsId, closeUserActionMenu]);

  const handleScrollTouchEnd = useCallback(() => {
    if (touchScrolledRef.current) return;
    if (Keyboard.isVisible()) Keyboard.dismiss();
  }, []);

  const handleScrollBeginDrag = useCallback(() => {
    touchScrolledRef.current = true;
    clearPinLanding();
    if (keyboardOpenRef.current) {
      userScrolledDuringKeyboard.current = true;
    }
    if (!pinActive.current && pinAnchor) {
      pinReleaseRef.current = true;
    }
  }, [clearPinLanding, pinAnchor]);

  const handleForkMessage = useCallback(
    (message: Message) => {
      onForkMessage?.(message);
    },
    [onForkMessage]
  );

  const handleContentSizeChange = useCallback(
    (_w: number, h: number) => {
      contentHeight.current = h;
      tryPlacePin();
      if (
        pinHoldRef.current &&
        pinLandedShort(lastScrollOffset.current, pinOffset.current) &&
        pinTargetReachable({
          contentHeight: h,
          layoutHeight: lastLayoutHeight.current || containerHeight.current,
          target: pinOffset.current,
        })
      ) {
        placePin();
      }
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

      // After send: now that the new chat row has rendered, pin it.
      // Doing this here (instead of synchronously in onMessageSent)
      // avoids a 1-frame flick where the old content gets lifted before
      // the new DOM commits.
      applyPendingPin();

      // During streaming, check if content has grown past the viewport
      // so the scroll-to-bottom button can appear without the user
      // needing to scroll manually. Use the last known scroll offset
      // (0 if user never scrolled) and the container height as a proxy
      // for the visible area.
      if (containerHeight.current > 0) {
        const atBottom = atListEnd({
          offset: lastScrollOffset.current,
          contentHeight: h,
          layoutHeight: lastLayoutHeight.current || containerHeight.current,
          floorTarget: pinFloorRef.current > 0 ? releaseTarget() : null,
          pinInFlight: pinActive.current || pendingPinRef.current,
        });
        if (atBottom !== isAtBottomRef.current) {
          isAtBottomRef.current = atBottom;
          setShowScrollButton(!atBottom);
        }
      }
    },
    [
      applyPendingPin,
      listBottomPadding,
      listTopPadding,
      placePin,
      releaseTarget,
      scheduleInitialScrollToEnd,
      tryPlacePin,
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
    return messageRowKey(message, index);
  };

  const assistantMeasurementKey = (): string | null => {
    if (generationError) return GENERATION_ERROR_MEASUREMENT_KEY;
    return measurementKeyAt(lastAssistantIndex);
  };

  lastUserMeasurementKey.current = measurementKeyAt(lastUserIndex);
  lastAssistantMeasurementKey.current = assistantMeasurementKey();

  return (
    <View style={styles.container}>
      <Reanimated.View
        style={[
          styles.container,
          revealed ? styles.revealed : animatedContainerStyle,
        ]}
      >
        <KeyboardChatScrollView
          ref={scrollRef}
          keyboardLiftBehavior={keyboardLiftBehavior}
          offset={bottomOffset}
          extraContentPadding={extraContentPadding}
          freeze={scrollFreeze}
          applyWorkaroundForContentInsetHitTestBug
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={contentContainerStyle}
          scrollIndicatorInsets={scrollIndicatorInsets}
          onLayout={handleContainerLayout}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          onTouchStart={handleScrollTouchStart}
          onTouchEnd={handleScrollTouchEnd}
          onContentSizeChange={handleContentSizeChange}
          scrollEventThrottle={16}
          style={styles.container}
        >
          {chatHistory.map((message, index) => {
            const isLastMessage = index === chatHistory.length - 1;
            const userQuestion = questionForAssistantAt[index];
            const key = messageRowKey(message, index);

            let onLayout: ((event: LayoutChangeEvent) => void) | undefined;
            if (index === lastUserIndex) {
              onLayout = (event) => handleLastUserLayout(key, event);
            } else if (index === lastAssistantIndex) {
              onLayout = (event) => handleLastAssistantLayout(key, event);
            }
            const branchMarker = latestBranchMarkerByMessageId.get(message.id);
            const { showActions, showForkAction, forkDisabled } =
              getMessageActionsState(message);

            const item = (
              <View
                style={styles.messageRow}
                collapsable={false}
                onLayout={index === lastAssistantIndex ? onLayout : undefined}
              >
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
                  forkDisabled={forkDisabled}
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

            // A row that changes wrapper type is remounted, and every
            // entering animation inside it plays again. The last turn's
            // rows gain and lose their measurement props on every send,
            // so the wrapper stays the same element for all of them.
            const rowStyle =
              index === lastAssistantIndex ? pinFloorStyle : undefined;
            const measureRow = index === lastUserIndex ? onLayout : undefined;

            return (
              <View
                key={key}
                style={rowStyle}
                onLayout={measureRow}
                collapsable={false}
              >
                {shouldHandleUserLongPress ? (
                  <LongPressableMessage
                    messageId={message.id}
                    onLongPress={handleUserLongPress}
                  >
                    {item}
                  </LongPressableMessage>
                ) : (
                  item
                )}
              </View>
            );
          })}
          {generationError && (
            <View style={pinFloorStyle} collapsable={false}>
              <View
                onLayout={(event) =>
                  handleLastAssistantLayout(
                    GENERATION_ERROR_MEASUREMENT_KEY,
                    event
                  )
                }
                collapsable={false}
                style={styles.generationError}
                testID="generation-error"
              >
                <Text style={styles.generationErrorText}>
                  {generationError}
                </Text>
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
            </View>
          )}
        </KeyboardChatScrollView>
      </Reanimated.View>

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
    </View>
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
    revealed: {
      opacity: 1,
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
      paddingBottom: 24,
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
