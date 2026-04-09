import React, {
  Ref,
  useLayoutEffect,
  useRef,
  useMemo,
  useCallback,
  useImperativeHandle,
} from 'react';
import {
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
  View,
} from 'react-native';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import Reanimated from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import MessageItem from './MessageItem';
import { useTheme } from '../../context/ThemeContext';
import { Message } from '../../database/chatRepository';
import { Theme } from '../../styles/colors';

export interface MessagesHandle {
  /**
   * Called synchronously from the send handler. Scrolls the newly-sent user
   * message to the top of the viewport once it lays out. The blankSpace
   * shared value is derived continuously from measured heights, so no
   * explicit "reservation amount" is needed — see the v0 iOS app blog post:
   * https://vercel.com/blog/how-we-built-the-v0-ios-app
   */
  onMessageSent: () => void;
}

interface Props {
  chatHistory: Message[];
  extraContentPadding: SharedValue<number>;
  blankSpace: SharedValue<number>;
  /** Whether the LLM is currently streaming a response. */
  isGenerating: boolean;
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
  freeze = false,
  ref,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollRef = useRef<Reanimated.ScrollView>(null);
  const isAtBottomRef = useRef(true);

  // Heights that drive blankSpace. All in JS refs because updates are
  // driven by layout events and we only need to write the derived value
  // into the shared value once per change.
  const containerHeight = useRef(0);
  const lastUserHeight = useRef(0);
  const lastAssistantHeight = useRef(0);

  // The derived blankSpace formula stays active from send onward so
  // layout changes after generation (e.g. the ttft/tps stats row
  // mounting in the assistant bubble) shrink blankSpace in lockstep
  // with the assistant row growing — keeping the user message visually
  // steady. Cleared only when the user switches chats (component
  // unmounts) or when a fresh send reseeds it.
  const pinSessionActive = useRef(false);
  // Separate flag that only stays true during streaming. Gates the
  // force-scroll-to-bottom behaviour in handleContentSizeChange so we
  // don't keep force-scrolling after generation ends.
  const streamingActive = useRef(false);
  const pendingScrollToEnd = useRef(false);

  // Stop the streaming force-scroll when generation ends. useLayoutEffect
  // flips the flag before the post-generation render commits its layout
  // events so the stats row mount doesn't trigger an unwanted scroll.
  useLayoutEffect(() => {
    if (!isGenerating) {
      streamingActive.current = false;
    }
  }, [isGenerating]);

  const recomputeBlankSpace = useCallback(() => {
    if (!pinSessionActive.current) return;
    const CONTAINER_PADDING = 16 + 8;
    const next = Math.max(
      0,
      containerHeight.current -
        lastUserHeight.current -
        lastAssistantHeight.current -
        CONTAINER_PADDING
    );
    blankSpace.value = next;
  }, [blankSpace]);

  useImperativeHandle(
    ref,
    () => ({
      onMessageSent: () => {
        // The new user message hasn't laid out yet, and the streaming
        // assistant placeholder is empty → both heights are effectively
        // unknown. Reset the assistant height so the first recompute
        // (triggered by the user-message onLayout) maximises blankSpace.
        lastAssistantHeight.current = 0;
        pinSessionActive.current = true;
        streamingActive.current = true;
        pendingScrollToEnd.current = true;
        // Seed blankSpace to the full container height immediately so the
        // scroll-to-end below has room to push the user message up. The
        // real value gets recomputed as soon as the user row measures.
        if (containerHeight.current > 0) {
          blankSpace.value = containerHeight.current;
        }
      },
    }),
    [blankSpace]
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
      // After the user message has measured AND blankSpace has been sized
      // large enough, pull the scroll view to the end so the user row lands
      // at the top of the visible area.
      if (pendingScrollToEnd.current) {
        pendingScrollToEnd.current = false;
        requestAnimationFrame(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        });
      }
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
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      isAtBottomRef.current = distanceFromBottom < 50;
    },
    []
  );

  const handleContentSizeChange = useCallback(() => {
    // While streaming AND blankSpace hasn't saturated to 0, the v0
    // technique handles positioning via contentInset — leave scroll alone.
    if (streamingActive.current && blankSpace.value > 0) return;
    // Otherwise, follow the bottom. During streaming that has just
    // saturated (response outgrew the pinned region), force the scroll
    // regardless of isAtBottomRef because the native scroll position
    // hasn't been updated since the initial scrollToEnd at send time.
    // Once streaming ends, defer to whether the user is at the bottom.
    if (streamingActive.current || isAtBottomRef.current) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [blankSpace]);

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
    <KeyboardChatScrollView
      ref={scrollRef}
      keyboardLiftBehavior="whenAtEnd"
      extraContentPadding={extraContentPadding}
      blankSpace={blankSpace}
      freeze={freeze}
      applyWorkaroundForContentInsetHitTestBug
      keyboardDismissMode="interactive"
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
  });
