import React, { RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  Text,
  StyleSheet,
  View,
  TextInput,
  Platform,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { ScrollView } from 'react-native-gesture-handler';
import { SharedValue } from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useChatStore } from '../../store/chatStore';
import { useLLMStore } from '../../store/llmStore';
import { chatLabel } from '../../utils/chatLabel';
import { DrawerItem } from './DrawerItem';
import { DrawerTopBar } from './DrawerTopBar';
import { DrawerNavSection } from './DrawerNavSection';
import { DrawerEmptyState } from './DrawerEmptyState';
import { DrawerFooter } from './DrawerFooter';
import { GlassScrollEdge } from '../chat-screen/GlassScrollEdge';
import { buildChatSections, sortChatsByRecency } from './chatSections';
import { useChatMenu } from '../chat-menu/useChatMenu';
import {
  DRAWER_HORIZONTAL_PADDING,
  getDrawerHeaderHeight,
  getDrawerTopPadding,
  SECTION_GAP,
} from '../../constants/drawer-layout';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { scrollIndicatorProps } from '../../constants/scroll-indicator';
import { space } from '../../constants/design-system';

interface Props {
  searching: boolean;
  search: string;
  now: number;
  navHeight: number;
  onNavMeasured: (height: number) => void;
  onChangeSearch: (value: string) => void;
  onOpenSearch?: () => void;
  onCloseSearch: () => void;
  onSearchBlur?: () => void;
  onMenuActiveChange?: (active: boolean) => void;
  onNavigate?: () => void;
  inputRef?: RefObject<TextInput | null>;
  scrollRef?: RefObject<ScrollView | null>;
  scrollOffsetRef?: RefObject<number>;
  searchProgress?: SharedValue<number>;
  resetScrollPosition?: boolean;
  newChatCollapse?: SharedValue<number>;
  onListScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const DrawerMenu = ({
  searching,
  search,
  now,
  navHeight,
  onNavMeasured,
  onChangeSearch,
  onOpenSearch,
  onCloseSearch,
  onSearchBlur,
  onMenuActiveChange,
  onNavigate,
  inputRef,
  scrollRef: externalScrollRef,
  scrollOffsetRef,
  searchProgress,
  resetScrollPosition,
  newChatCollapse,
  onListScroll,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const headerHeight = getDrawerHeaderHeight(theme.insets.top);

  const router = useRouter();
  const pathname = usePathname();

  const chats = useChatStore((state) => state.chats);
  const interrupt = useLLMStore((state) => state.interrupt);

  const { openMenu, openChatId, MenuElements } = useChatMenu({
    onActiveChange: onMenuActiveChange,
  });

  const query = search.trim().toLowerCase();
  const isFiltering = query.length > 0;

  const sortedChats = useMemo(() => sortChatsByRecency(chats), [chats]);
  const sections = useMemo(
    () => buildChatSections(sortedChats, query, now),
    [sortedChats, query, now]
  );

  const hasNoResults = isFiltering && sections.length === 0;

  const [footerHeight, setFooterHeight] = useState(0);
  const handleFooterLayout = (event: LayoutChangeEvent) =>
    setFooterHeight(event.nativeEvent.layout.height);

  const internalScrollRef = useRef<ScrollView>(null);
  const scrollRef = externalScrollRef ?? internalScrollRef;

  const [initialScrollOffset] = useState(() => scrollOffsetRef?.current ?? 0);
  const initialContentOffset = useMemo(
    () => ({ x: 0, y: initialScrollOffset }),
    [initialScrollOffset]
  );
  const isInitialQuery = useRef(true);
  const didRestoreScroll = useRef(false);

  useEffect(() => {
    if (isInitialQuery.current) {
      isInitialQuery.current = false;
      return;
    }

    scrollRef.current?.scrollTo({
      y: query ? 0 : (scrollOffsetRef?.current ?? 0),
      animated: false,
    });
  }, [query, scrollRef, scrollOffsetRef]);

  useEffect(() => {
    if (resetScrollPosition) {
      if (scrollOffsetRef) scrollOffsetRef.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [resetScrollPosition, scrollRef, scrollOffsetRef]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onListScroll?.(event);
    if (!scrollOffsetRef || isFiltering) return;
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  };

  const handleContentSizeChange = () => {
    if (Platform.OS === 'ios' || didRestoreScroll.current) return;
    didRestoreScroll.current = true;
    if (initialScrollOffset) {
      scrollRef.current?.scrollTo({ y: initialScrollOffset, animated: false });
    }
  };

  const openChat = (chatId: number) => {
    interrupt();
    router.replace(`/chat/${chatId}`);
    onNavigate?.();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        testID="drawer-scroll"
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          searching
            ? styles.contentSearching
            : { paddingBottom: footerHeight + space.four },
        ]}
        contentOffset={initialContentOffset}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps={hasNoResults ? 'always' : 'handled'}
        {...scrollIndicatorProps(headerHeight, searching ? 0 : footerHeight)}
      >
        <DrawerNavSection
          collapsed={isFiltering}
          height={navHeight}
          onMeasured={onNavMeasured}
          onNavigate={onNavigate}
        />

        {sections.map(([sectionTitle, sectionChats]) => (
          <View key={sectionTitle} style={styles.section}>
            <Text style={styles.sectionTitle}>{sectionTitle}</Text>
            <View>
              {sectionChats.map((chat) => (
                <DrawerItem
                  key={chat.id}
                  variant="chat"
                  testID={`drawer-chat-${chat.id}`}
                  label={chatLabel(chat)}
                  active={pathname === `/chat/${chat.id}`}
                  highlighted={openChatId === chat.id}
                  onPress={() => openChat(chat.id)}
                  onLongPress={(rect) =>
                    openMenu(chat, { ...rect, align: 'start' })
                  }
                />
              ))}
            </View>
          </View>
        ))}

        {hasNoResults && (
          <DrawerEmptyState query={search.trim()} onNavigate={onNavigate} />
        )}
      </ScrollView>

      <GlassScrollEdge anchor={headerHeight} />
      <View style={styles.topBar}>
        <DrawerTopBar
          searching={searching}
          search={search}
          onChangeSearch={onChangeSearch}
          onOpenSearch={onOpenSearch}
          onCloseSearch={onCloseSearch}
          onBlur={onSearchBlur}
          inputRef={inputRef}
          progress={searchProgress}
        />
      </View>

      {!searching && (
        <>
          <GlassScrollEdge edge="bottom" anchor={footerHeight} />
          <View style={styles.footer} onLayout={handleFooterLayout}>
            <DrawerFooter
              onNavigate={onNavigate}
              newChatCollapse={newChatCollapse}
            />
          </View>
        </>
      )}

      {MenuElements}
    </View>
  );
};

export default DrawerMenu;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingTop: getDrawerTopPadding(theme.insets.top),
      paddingHorizontal: DRAWER_HORIZONTAL_PADDING,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingTop: getDrawerHeaderHeight(theme.insets.top) + space.three,
      paddingBottom: space.four,
      paddingHorizontal: DRAWER_HORIZONTAL_PADDING,
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
    },
    contentSearching: {
      paddingBottom: theme.insets.bottom + 16,
    },
    section: {
      gap: space.half,
      marginBottom: SECTION_GAP,
    },
    sectionTitle: {
      alignSelf: 'flex-start',
      paddingHorizontal: space.three,
      paddingBottom: space.one,
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      letterSpacing: 0.24,
      color: theme.text.defaultTertiary,
    },
  });
