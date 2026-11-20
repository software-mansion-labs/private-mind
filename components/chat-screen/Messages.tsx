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
import { showCopiedToast } from '../../utils/copiedToast';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import Reanimated, {
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import MessageItem from './MessageItem';
import ScrollToLatestButton from './ScrollToLatestButton';
import SourcesSheet, { type SourcesSheetHandle } from './SourcesSheet';
import { EdgeFade } from './EdgeFade';
import { topFadeHeight } from './TopFade';
import { GlassScrollEdge } from './GlassScrollEdge';
import {
  Message,
  SourceDocument,
  type ChatBranchMarker,
} from '../../database/chatRepository';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { Feedback } from '../../utils/Feedback';
import RotateLeftIcon from '../../assets/icons/rotate_left.svg';
import BranchMarker from './BranchMarker';
import OnDeviceNote from './OnDeviceNote';
import StoppedMarker from './StoppedMarker';
import { endsTurnCutShort } from './cutShortTurn';
import {
  BOTTOM_FADE_HEIGHT,
  GENERATION_ERROR_MEASUREMENT_KEY,
  MESSAGE_PIN_SETTLE_MS,
  ON_DEVICE_NOTE_FADE_MS,
  PIN_LANDING_GRACE_MS,
  PIN_READY_SLACK_PX,
  navBarInset,
  PIN_RELEASE_SETTLE_DELAY_MS,
  REVEAL_FALLBACK_MS,
  SCROLL_INDICATOR_GUTTER,
  SEAM_OVERLAP,
  SUPPORTS_USER_ACTION_MENU,
  MESSAGE_LIST_SIDE_PADDING,
} from '../../constants/chat-screen';
import { messageRowKey } from '../../utils/messageRowKey';
import {
  SCROLL_INDICATOR_INPUT_GAP,
  scrollIndicatorProps,
} from '../../constants/scroll-indicator';
import { useKeyboardLift } from './useKeyboardLift';
import {
  selectKeyboardOwnedElsewhere,
  useKeyboardOwnerStore,
} from '../../store/keyboardOwnerStore';
import { useSendKeyboardFreeze } from './useSendKeyboardFreeze';
import {
  blankLeftBehind,
  floorIsOffscreen,
  floorIsOutgrown,
  lastTurnRows,
  pinFloorFor,
  pinHasMoved,
  pinIsReachable,
  pinLandingFrom,
  pinOffsetFor,
  pinReleaseTarget,
  scrollButtonShows,
  turnEndFor,
  stoppedTurnLandsShort,
} from './pinScroll';
import { visibleMessageText } from '../../utils/messageText';
import { pressedOpacity } from '../../styles/pressable';
import { radius, space } from '../../constants/design-system';

export interface MessagesHandle {
  onMessageSent: (options?: { questionAlreadyShown?: boolean }) => void;
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
  turnInFlight: boolean;
  generationError?: string;
  onRetryGeneration?: () => void;
  canRetryGeneration?: boolean;
  turnFooter?: ReactNode;
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

const stoppedWithNothingToShow = (message: Message) => message.role === 'user';

interface LongPressableMessageProps {
  children: ReactNode;
  messageId: number;
  enabled: boolean;
  onLongPress: (messageId: number, target: ViewType | null) => void;
}

const LongPressableMessage = memo(
  ({
    children,
    messageId,
    enabled,
    onLongPress,
  }: LongPressableMessageProps) => {
    const targetRef = useRef<ViewType>(null);
    const handleLongPress = useCallback(() => {
      onLongPress(messageId, targetRef.current);
    }, [messageId, onLongPress]);

    const longPressGesture = useMemo(
      () =>
        Gesture.LongPress()
          .enabled(enabled)
          .minDuration(450)
          .onStart(() => {
            runOnJS(handleLongPress)();
          }),
      [enabled, handleLongPress]
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

const SENT_TURN_ROWS_TIMEOUT_MS = 3000;
const OPENED_CHAT_FOLLOWS_END_MS = 2500;
const MESSAGE_WINDOW_INITIAL = 40;
const MESSAGE_WINDOW_STEP = 40;
const MESSAGE_WINDOW_TOP_TRIGGER = 600;
const KEEP_VISIBLE_ROW_ON_PREPEND = { minIndexForVisible: 0 };

const initialWindowStart = (length: number) =>
  Math.max(0, length - MESSAGE_WINDOW_INITIAL);

const Messages = ({
  chatHistory,
  extraContentPadding,
  isGenerating,
  turnInFlight,
  generationError,
  onRetryGeneration,
  canRetryGeneration = false,
  turnFooter,
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
  const { styles } = useThemedStyles(createStyles);
  const scrollRef = useRef<Reanimated.ScrollView>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const pinLandingUntil = useRef(0);
  const updateScrollButton = useCallback((atBottom: boolean) => {
    const pinLanding =
      pendingPinRef.current || Date.now() < pinLandingUntil.current;
    setShowScrollButton(scrollButtonShows(atBottom, pinLanding));
  }, []);
  const [activeUserActionsId, setActiveUserActionsId] = useState<number | null>(
    null
  );
  const [windowStart, setWindowStart] = useState(() =>
    initialWindowStart(chatHistory.length)
  );
  const firstMessageId = chatHistory[0]?.id;
  const [windowOwnerId, setWindowOwnerId] = useState(firstMessageId);
  if (windowOwnerId !== firstMessageId) {
    setWindowOwnerId(firstMessageId);
    setWindowStart(initialWindowStart(chatHistory.length));
  }
  const firstRenderedIndex = Math.min(windowStart, chatHistory.length);
  const firstRenderedIndexRef = useRef(firstRenderedIndex);
  firstRenderedIndexRef.current = firstRenderedIndex;
  const lastScrollOffset = useRef(0);
  const lastLayoutHeight = useRef(0);
  const sourcesSheetRef = useRef<SourcesSheetHandle>(null);

  const handleShowSources = useCallback(
    (sources: SourceDocument[], question?: string) =>
      sourcesSheetRef.current?.present(sources, question),
    []
  );

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
  const keyboardOwnedElsewhere = useKeyboardOwnerStore(
    selectKeyboardOwnedElsewhere
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

  const fadeAnchor = fadeBottom ?? topInset;
  const listTopPadding = Math.max(topInset, topFadeHeight(fadeAnchor)) + 16;
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
    if (chatHistory.length === 0) setShowScrollButton(false);

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
      pinFollowsLayout.current = false;
      pinScrollPendingRef.current = false;
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
  const pinScrollPendingRef = useRef(false);
  const pinLandedSinceKeyboardShow = useRef(false);
  const questionTop = useRef(0);
  const pinFollowsLayout = useRef(false);
  const pinLandedAt = useRef<number | null>(null);
  const supersededQuestionKey = useRef<string | null>(null);

  const onDeviceNoteOpacity = useSharedValue(1);
  const onDeviceNoteStyle = useAnimatedStyle(() => ({
    opacity: onDeviceNoteOpacity.get(),
  }));
  const onDeviceNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealOnDeviceNote = useCallback(
    (afterMs: number) => {
      if (onDeviceNoteTimer.current) clearTimeout(onDeviceNoteTimer.current);
      onDeviceNoteTimer.current = setTimeout(() => {
        onDeviceNoteTimer.current = null;
        onDeviceNoteOpacity.set(
          withTiming(1, { duration: ON_DEVICE_NOTE_FADE_MS })
        );
      }, afterMs);
    },
    [onDeviceNoteOpacity]
  );
  useEffect(
    () => () => {
      if (onDeviceNoteTimer.current) clearTimeout(onDeviceNoteTimer.current);
    },
    []
  );

  const scrollToPin = useCallback(() => {
    revealOnDeviceNote(PIN_LANDING_GRACE_MS);
    pinLandedAt.current = pinOffset.current;
    pinLandedSinceKeyboardShow.current = true;
    pinLandingUntil.current = Date.now() + PIN_LANDING_GRACE_MS;
    const scrollView = scrollRef.current;
    if (!scrollView) return;
    const { jumpTo, animateTo } = pinLandingFrom(
      lastScrollOffset.current,
      pinOffset.current
    );
    if (jumpTo !== null) {
      scrollView.scrollTo({ y: jumpTo, animated: false });
    }
    scrollView.scrollTo({ y: animateTo, animated: true });
  }, [revealOnDeviceNote]);

  const landAfterKeyboard = useCallback(() => {
    if (pinActive.current) {
      if (!pendingPinRef.current && !pinLandedSinceKeyboardShow.current) {
        scrollToPin();
      }
      return;
    }
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [scrollToPin]);

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
  const [floorOutgrown, setFloorOutgrown] = useState(false);
  const floorHoldsList = !!pinAnchor && !floorOutgrown;
  const [liftHeldUntilKeyboardHides, setLiftHeldUntilKeyboardHides] =
    useState(false);
  const keyboardLiftBehavior =
    floorHoldsList || liftHeldUntilKeyboardHides || keyboardOwnedElsewhere
      ? 'never'
      : 'whenAtEnd';
  useEffect(() => {
    if (!liftHeldUntilKeyboardHides) return;
    const hidden = Keyboard.addListener('keyboardDidHide', () =>
      setLiftHeldUntilKeyboardHides(false)
    );
    return () => hidden.remove();
  }, [liftHeldUntilKeyboardHides]);
  const [floorTrim, setFloorTrim] = useState(0);
  const floorTrimAwaitsLayout = useRef(false);
  const pinFloor = pinAnchor
    ? Math.max(
        0,
        pinFloorFor({
          containerHeight: pinAnchor.containerHeight,
          userHeight: pinAnchor.userHeight,
          listTopPadding,
          listBottomPadding,
        }) - floorTrim
      )
    : 0;
  const pinFloorRef = useRef(0);
  pinFloorRef.current = pinFloor;
  const [awaitedTurnAfterLength, setAwaitedTurnAfterLength] = useState<
    number | null
  >(null);
  const awaitingSentTurn = awaitedTurnAfterLength === chatHistory.length;
  const pinFloorStyle = useMemo(
    () =>
      pinFloor > 0 && !awaitingSentTurn ? { minHeight: pinFloor } : undefined,
    [awaitingSentTurn, pinFloor]
  );
  const sentTurnSpacerStyle = useMemo(
    () => (awaitingSentTurn && pinFloor > 0 ? { height: pinFloor } : undefined),
    [awaitingSentTurn, pinFloor]
  );
  const predictedPinPending = useRef(false);
  const sentTurnTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSentTurnTimeout = useCallback(() => {
    if (sentTurnTimeout.current) clearTimeout(sentTurnTimeout.current);
    sentTurnTimeout.current = null;
  }, []);
  useEffect(() => clearSentTurnTimeout, [clearSentTurnTimeout]);
  useEffect(() => {
    if (awaitingSentTurn) return;
    clearSentTurnTimeout();
    setAwaitedTurnAfterLength(null);
  }, [awaitingSentTurn, clearSentTurnTimeout]);

  const landPredictedPin = useCallback(() => {
    if (!predictedPinPending.current) return;
    if (
      !pinIsReachable(
        contentHeight.current,
        pinOffset.current,
        containerHeight.current
      )
    ) {
      return;
    }
    predictedPinPending.current = false;
    pinLandedAt.current = pinOffset.current;
    pinLandedSinceKeyboardShow.current = true;
    pinLandingUntil.current = Date.now() + PIN_LANDING_GRACE_MS;
    const { jumpTo, animateTo } = pinLandingFrom(
      lastScrollOffset.current,
      pinOffset.current,
      containerHeight.current
    );
    if (jumpTo !== null) {
      scrollRef.current?.scrollTo({ y: jumpTo, animated: false });
    }
    scrollRef.current?.scrollTo({ y: animateTo, animated: true });
  }, []);

  const followPin = useCallback(() => {
    if (!pinFollowsLayout.current) return;
    pinOffset.current = pinOffsetFor(
      questionTop.current,
      listPaddingRef.current.top
    );
    const userHeight = lastUserHeight.current;
    const height = containerHeight.current;
    setPinAnchor((anchor) =>
      anchor?.containerHeight === height && anchor.userHeight === userHeight
        ? anchor
        : { containerHeight: height, userHeight }
    );
    if (!pinHasMoved(pinLandedAt.current, pinOffset.current)) return;
    const reachable = pinIsReachable(
      contentHeight.current,
      pinOffset.current,
      height
    );
    pinScrollPendingRef.current = !reachable;
    if (reachable) scrollToPin();
  }, [scrollToPin]);

  const applyPendingPin = useCallback(() => {
    if (!pendingPinRef.current || containerHeight.current === 0) return;
    if (lastUserHeight.current === 0) return;

    pendingPinRef.current = false;
    predictedPinPending.current = false;
    supersededQuestionKey.current = null;
    closeUserActionMenu();
    pinFollowsLayout.current = true;
    followPin();
  }, [closeUserActionMenu, followPin]);

  const pinReleaseRef = useRef(false);
  const releaseSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearReleaseSettle = useCallback(() => {
    if (releaseSettleTimer.current) clearTimeout(releaseSettleTimer.current);
    releaseSettleTimer.current = null;
  }, []);
  useEffect(() => clearReleaseSettle, [clearReleaseSettle]);

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
    clearReleaseSettle();
    setPinAnchor(null);
    if (Keyboard.isVisible()) setLiftHeldUntilKeyboardHides(true);
  }, [clearReleaseSettle]);

  const noteFloorOutgrown = useCallback(() => {
    if (pinActive.current) return;
    setFloorOutgrown(
      floorIsOutgrown(pinFloorRef.current, lastAssistantHeight.current)
    );
  }, []);

  const settlePinRelease = useCallback(() => {
    if (!pinReleaseRef.current || Keyboard.isVisible()) return;
    if (floorTrimAwaitsLayout.current) return;
    const offset = lastScrollOffset.current;
    if (floorIsOffscreen(offset, releaseTarget())) {
      dropPinFloor();
      return;
    }
    const leftBehind = blankLeftBehind({
      offset,
      contentHeight: contentHeight.current,
      layoutHeight: lastLayoutHeight.current || containerHeight.current,
      extraPadding: extraContentPadding.get(),
    });
    if (leftBehind <= 0) return;
    floorTrimAwaitsLayout.current = true;
    setFloorTrim((trimmed) => trimmed + leftBehind);
  }, [dropPinFloor, extraContentPadding, releaseTarget]);

  useEffect(() => {
    if (turnInFlight || !pinActive.current) return;
    const timer = setTimeout(() => {
      pinActive.current = false;
      pinFollowsLayout.current = false;
      if (pinScrollPendingRef.current) {
        pinScrollPendingRef.current = false;
        scrollToPin();
      }
      noteFloorOutgrown();
    }, MESSAGE_PIN_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [noteFloorOutgrown, scrollToPin, turnInFlight]);

  const lastMessage = chatHistory[chatHistory.length - 1];
  const stoppedTurnKey =
    lastMessage && (lastMessage.stoppedByUser || lastMessage.cutShortReason)
      ? messageRowKey(lastMessage, chatHistory.length - 1)
      : null;

  useEffect(() => {
    if (
      !stoppedTurnLandsShort({
        turnWasStopped: !!stoppedTurnKey,
        isGenerating,
        floorStillReserved: floorHoldsList,
        atBottom: isAtBottomRef.current,
      })
    ) {
      return;
    }
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [stoppedTurnKey, isGenerating, floorHoldsList, scrollRef]);

  const latestHistoryLength = useRef(chatHistory.length);
  latestHistoryLength.current = chatHistory.length;

  const abandonSentTurn = useCallback(() => {
    sentTurnTimeout.current = null;
    predictedPinPending.current = false;
    pinLandedAt.current = null;
    setAwaitedTurnAfterLength(null);
    setPinAnchor(null);
    scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      scrollToEnd: () => {
        closeUserActionMenu();
        scrollRef.current?.scrollToEnd({ animated: true });
      },
      scrollToEndIfAtBottom: () => {
        if (!isAtBottomRef.current) return;
        if (!floorHoldsList) {
          scrollRef.current?.scrollToEnd({ animated: true });
          return;
        }
        const answerEnd = pinReleaseTarget({
          contentHeight: contentHeight.current,
          layoutHeight: lastLayoutHeight.current || containerHeight.current,
          floor: pinFloorRef.current,
          rowHeight: lastAssistantHeight.current,
          extraPadding:
            extraContentPadding.get() + Math.max(0, -keyboardLift.get()),
        });
        if (answerEnd > lastScrollOffset.current + PIN_READY_SLACK_PX) {
          scrollRef.current?.scrollTo({ y: answerEnd, animated: true });
        }
      },
      onMessageSent: ({ questionAlreadyShown = false } = {}) => {
        closeUserActionMenu();
        if (prevChatLengthRef.current === 0) onDeviceNoteOpacity.set(0);
        // Ensure the view is visible (covers new-chat case where the
        // initial-scroll effect hasn't fired because there were no
        // messages yet).
        if (!hasScrolledToEnd.current) {
          hasScrolledToEnd.current = true;
          opacity.set(1);
          revealTranslateY.set(0);
          settleReveal(0);
        }
        if (!isAtBottomRef.current) {
          isAtBottomRef.current = true;
          setShowScrollButton(false);
        }
        initialScrollSettlingUntil.current = 0;
        const turnEnd = turnEndFor({
          contentHeight: contentHeight.current,
          listBottomPadding: listPaddingRef.current.bottom,
          floor: pinFloorRef.current,
          rowHeight: lastAssistantHeight.current,
        });
        lastAssistantHeight.current = 0;
        if (!questionAlreadyShown) {
          lastUserHeight.current = 0;
          supersededQuestionKey.current = lastUserMeasurementKey.current;
        }
        pinActive.current = true;
        pinFollowsLayout.current = false;
        pinLandedAt.current = null;
        pinReleaseRef.current = false;
        pendingPinRef.current = true;
        predictedPinPending.current = false;
        setFloorOutgrown(false);
        setFloorTrim(0);
        if (!questionAlreadyShown && containerHeight.current > 0) {
          setPinAnchor({
            containerHeight: containerHeight.current,
            userHeight: 0,
          });
          if (contentHeight.current > 0) {
            pinOffset.current = pinOffsetFor(
              turnEnd,
              listPaddingRef.current.top
            );
            predictedPinPending.current = true;
            setAwaitedTurnAfterLength(latestHistoryLength.current);
            clearSentTurnTimeout();
            sentTurnTimeout.current = setTimeout(
              abandonSentTurn,
              SENT_TURN_ROWS_TIMEOUT_MS
            );
          }
        }
        freezeForSend();
        if (questionAlreadyShown) applyPendingPin();
      },
      cancelMessageSent: () => {
        revealOnDeviceNote(0);
        clearSentTurnTimeout();
        predictedPinPending.current = false;
        setAwaitedTurnAfterLength(null);
        pendingPinRef.current = false;
        supersededQuestionKey.current = null;
        pinFollowsLayout.current = false;
        pinScrollPendingRef.current = false;
        pinReleaseRef.current = false;
        pinActive.current = false;
        releaseSendFreeze();
        setPinAnchor(null);
      },
    }),
    [
      abandonSentTurn,
      applyPendingPin,
      clearSentTurnTimeout,
      closeUserActionMenu,
      extraContentPadding,
      floorHoldsList,
      freezeForSend,
      keyboardLift,
      onDeviceNoteOpacity,
      opacity,
      releaseSendFreeze,
      revealOnDeviceNote,
      revealTranslateY,
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
      followPin();
      if (
        !pinActive.current &&
        Date.now() < initialScrollSettlingUntil.current
      ) {
        snapToEnd();
      }
    },
    [followPin, snapToEnd]
  );

  const handleLastUserLayout = useCallback(
    (key: string, e: LayoutChangeEvent) => {
      if (lastUserMeasurementKey.current !== key) return;
      if (supersededQuestionKey.current === key) return;
      lastUserHeight.current = e.nativeEvent.layout.height;
      questionTop.current = e.nativeEvent.layout.y;
      applyPendingPin();
      followPin();
    },
    [applyPendingPin, followPin]
  );

  const handleLastAssistantLayout = useCallback(
    (key: string, e: LayoutChangeEvent) => {
      if (lastAssistantMeasurementKey.current !== key) return;
      lastAssistantHeight.current = e.nativeEvent.layout.height;
      noteFloorOutgrown();
    },
    [noteFloorOutgrown]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement, contentInset } =
        event.nativeEvent;
      lastScrollOffset.current = contentOffset.y;
      lastLayoutHeight.current = layoutMeasurement.height;
      contentHeight.current = contentSize.height;
      const bottomInset = contentInset?.bottom ?? 0;
      const distanceFromBottom =
        contentSize.height +
        bottomInset -
        (contentOffset.y + layoutMeasurement.height);
      const atBottom = distanceFromBottom < 100;
      isAtBottomRef.current = atBottom;
      updateScrollButton(atBottom);
      if (
        hasScrolledToEnd.current &&
        firstRenderedIndexRef.current > 0 &&
        contentOffset.y < MESSAGE_WINDOW_TOP_TRIGGER
      ) {
        setWindowStart(
          Math.max(0, firstRenderedIndexRef.current - MESSAGE_WINDOW_STEP)
        );
      }
      if (
        pinReleaseRef.current &&
        floorIsOffscreen(contentOffset.y, releaseTarget())
      ) {
        dropPinFloor();
      }
    },
    [dropPinFloor, releaseTarget, updateScrollButton]
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
      showCopiedToast();
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

  const latestLongPressInputs = useRef({
    chatHistory,
    activeUserActionsId,
    handleCopyMessage,
    onUserActionMenuChange,
  });
  latestLongPressInputs.current = {
    chatHistory,
    activeUserActionsId,
    handleCopyMessage,
    onUserActionMenuChange,
  };

  const handleUserLongPress = useCallback(
    (messageId: number, target: ViewType | null) => {
      const {
        chatHistory: history,
        activeUserActionsId: activeId,
        handleCopyMessage: copyMessage,
        onUserActionMenuChange: notifyMenuChange,
      } = latestLongPressInputs.current;
      const message = history.find((item) => item.id === messageId);
      if (!message) return;

      const shouldOpen = activeId !== messageId;
      setActiveUserActionsId(shouldOpen ? messageId : null);

      if (!shouldOpen) {
        notifyMenuChange?.({ isOpen: false });
        return;
      }

      Feedback.longPress();

      const openMenu = () => {
        target?.measureInWindow((x, y, width, height) => {
          notifyMenuChange?.({
            isOpen: true,
            anchor: { x, y, width, height },
            onCopy: () => copyMessage(message),
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
    []
  );

  const touchScrolledRef = useRef(false);

  const handleScrollTouchStart = useCallback(() => {
    initialScrollSettlingUntil.current = 0;
    pinFollowsLayout.current = false;
    pinScrollPendingRef.current = false;
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
    if (keyboardOpenRef.current) {
      userScrolledDuringKeyboard.current = true;
    }
    clearReleaseSettle();
    if (!pinActive.current && pinAnchor) {
      pinReleaseRef.current = true;
    }
  }, [clearReleaseSettle, pinAnchor]);

  const handleScrollEndDrag = useCallback(() => {
    if (!pinReleaseRef.current) return;
    clearReleaseSettle();
    releaseSettleTimer.current = setTimeout(
      settlePinRelease,
      PIN_RELEASE_SETTLE_DELAY_MS
    );
  }, [clearReleaseSettle, settlePinRelease]);

  const handleMomentumScrollBegin = useCallback(() => {
    clearReleaseSettle();
  }, [clearReleaseSettle]);

  const handleMomentumScrollEnd = useCallback(() => {
    settlePinRelease();
  }, [settlePinRelease]);

  const handleForkMessage = useCallback(
    (message: Message) => {
      onForkMessage?.(message);
    },
    [onForkMessage]
  );

  const handleContentSizeChange = useCallback(
    (_w: number, h: number) => {
      contentHeight.current = h;
      floorTrimAwaitsLayout.current = false;
      landPredictedPin();
      followPin();
      // Initial reveal: content has been laid out for the first time.
      // Snap to bottom then fade in. This is the most reliable place to
      // scroll because the native content size is already committed.
      if (!hasScrolledToEnd.current) {
        if (latestHistoryLength.current === 0) return;
        if (h <= listTopPadding + listBottomPadding) return;

        hasScrolledToEnd.current = true;
        initialScrollSettlingUntil.current =
          Date.now() + OPENED_CHAT_FOLLOWS_END_MS;
        scheduleInitialScrollToEnd();
        return;
      }

      const openedChatStillSettling =
        Date.now() < initialScrollSettlingUntil.current;
      if (
        openedChatStillSettling &&
        !pinActive.current &&
        !pendingPinRef.current
      ) {
        snapToEnd();
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
        const layoutH = lastLayoutHeight.current || containerHeight.current;
        const distFromBottom = h - (lastScrollOffset.current + layoutH);
        const atBottom = distFromBottom < 100;
        if (atBottom !== isAtBottomRef.current) {
          isAtBottomRef.current = atBottom;
          updateScrollButton(atBottom);
        }
      }
    },
    [
      applyPendingPin,
      followPin,
      landPredictedPin,
      listBottomPadding,
      listTopPadding,
      scheduleInitialScrollToEnd,
      snapToEnd,
      updateScrollButton,
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

  const footerMeasuresTurn = !!generationError || !!turnFooter;
  const { userIndex: lastUserIndex, answerIndex: lastAssistantIndex } =
    lastTurnRows(
      chatHistory.map((message) => message.role),
      footerMeasuresTurn
    );

  const firstRowUnderFooter = turnFooter ? lastUserIndex : chatHistory.length;

  const measurementKeyAt = (index: number): string | null => {
    const message = chatHistory[index];
    if (!message) return null;
    return messageRowKey(message, index);
  };

  const assistantMeasurementKey = (): string | null => {
    if (footerMeasuresTurn) return GENERATION_ERROR_MEASUREMENT_KEY;
    return measurementKeyAt(lastAssistantIndex);
  };

  lastUserMeasurementKey.current = measurementKeyAt(lastUserIndex);
  lastAssistantMeasurementKey.current = assistantMeasurementKey();
  if (lastAssistantMeasurementKey.current === null) {
    lastAssistantHeight.current = 0;
  }

  const messageRows = useMemo(
    () =>
      chatHistory.slice(firstRenderedIndex).map((message, offset) => {
        const index = firstRenderedIndex + offset;
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
        const { showActions, showForkAction } = getMessageActionsState(message);

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
              onCopy={handleCopyMessage}
              onFork={handleForkMessage}
            />
            {message.stoppedByUser && (
              <StoppedMarker
                onRetry={
                  canRetryGeneration &&
                  stoppedWithNothingToShow(message) &&
                  isLastMessage &&
                  !isGenerating
                    ? onRetryGeneration
                    : undefined
                }
              />
            )}
            {endsTurnCutShort(chatHistory, index) &&
              index < firstRowUnderFooter && (
                <StoppedMarker reason={message.cutShortReason} />
              )}
            {branchMarker && (
              <BranchMarker
                key={`branch-${branchMarker.id}`}
                marker={branchMarker}
                onPress={onBranchMarkerPress}
              />
            )}
          </View>
        );

        const opensUserActionMenu =
          SUPPORTS_USER_ACTION_MENU && message.role === 'user';

        return (
          <View
            key={key}
            style={index === lastAssistantIndex ? pinFloorStyle : undefined}
            onLayout={index === lastUserIndex ? onLayout : undefined}
            collapsable={false}
          >
            {opensUserActionMenu ? (
              <LongPressableMessage
                messageId={message.id}
                enabled={message.id > 0}
                onLongPress={handleUserLongPress}
              >
                {item}
              </LongPressableMessage>
            ) : (
              item
            )}
          </View>
        );
      }),
    [
      canRetryGeneration,
      chatHistory,
      firstRenderedIndex,
      firstRowUnderFooter,
      getMessageActionsState,
      handleCopyMessage,
      handleForkMessage,
      handleLastAssistantLayout,
      handleLastUserLayout,
      handleShowSources,
      handleUserLongPress,
      isGenerating,
      lastAssistantIndex,
      lastUserIndex,
      latestBranchMarkerByMessageId,
      onBranchMarkerPress,
      onRetryGeneration,
      pinFloorStyle,
      questionForAssistantAt,
      styles.messageRow,
    ]
  );

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
          maintainVisibleContentPosition={KEEP_VISIBLE_ROW_ON_PREPEND}
          contentContainerStyle={contentContainerStyle}
          {...scrollIndicatorProps(
            topFadeHeight(fadeAnchor),
            chatBarInset + SCROLL_INDICATOR_INPUT_GAP
          )}
          onLayout={handleContainerLayout}
          onScroll={handleScroll}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollBegin={handleMomentumScrollBegin}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onTouchStart={handleScrollTouchStart}
          onTouchEnd={handleScrollTouchEnd}
          onContentSizeChange={handleContentSizeChange}
          scrollEventThrottle={16}
          style={styles.container}
        >
          {hasMessages && firstRenderedIndex === 0 && (
            <Reanimated.View style={onDeviceNoteStyle}>
              <OnDeviceNote />
            </Reanimated.View>
          )}
          {messageRows}
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
                    pressed && pressedOpacity,
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
          {!generationError && turnFooter && (
            <View style={pinFloorStyle} collapsable={false}>
              <View
                onLayout={(event) =>
                  handleLastAssistantLayout(
                    GENERATION_ERROR_MEASUREMENT_KEY,
                    event
                  )
                }
                collapsable={false}
              >
                {turnFooter}
              </View>
            </View>
          )}
          {sentTurnSpacerStyle && <View style={sentTurnSpacerStyle} />}
        </KeyboardChatScrollView>
      </Reanimated.View>

      {hasMessages && <GlassScrollEdge anchor={fadeAnchor} />}
      {hasMessages && (
        <Reanimated.View
          style={[styles.bottomFade, bottomFadeAnimatedStyle]}
          pointerEvents="none"
        >
          <EdgeFade edge="bottom" style={styles.bottomFadeRamp} />
          <View style={styles.bottomFadeSolid} />
        </Reanimated.View>
      )}
      {hasMessages && (
        <Reanimated.View
          style={[scrollButtonStyle, scrollButtonAnimatedStyle]}
          pointerEvents="box-none"
        >
          <ScrollToLatestButton
            visible={showScrollButton}
            onPress={scrollToBottom}
          />
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
      paddingHorizontal: MESSAGE_LIST_SIDE_PADDING,
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
      paddingBottom: space.six,
      gap: space.two,
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
      borderRadius: radius.full,
      backgroundColor: theme.bg.softTertiary,
      paddingHorizontal: space.three,
      paddingVertical: space.two,
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
  });
};
