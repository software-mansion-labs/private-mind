import React, { RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  Text,
  StyleSheet,
  View,
  TextInput,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { ScrollView } from 'react-native-gesture-handler';
import { SharedValue } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { useChatStore } from '../../store/chatStore';
import { useLLMStore } from '../../store/llmStore';
import { chatLabel } from '../../utils/chatLabel';
import { DrawerItem } from './DrawerItem';
import { DrawerTopBar } from './DrawerTopBar';
import { DrawerNavSection } from './DrawerNavSection';
import { DrawerEmptyState } from './DrawerEmptyState';
import { buildChatSections, sortChatsByRecency } from './chatSections';
import { useDrawerChatMenu } from './useDrawerChatMenu';
import {
  DRAWER_HORIZONTAL_PADDING,
  SECTION_GAP,
} from '../../constants/drawer-layout';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';

const scrollIndicatorInsets = Platform.select({
  ios: { right: 1 },
});

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
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const router = useRouter();
  const pathname = usePathname();

  const { chats } = useChatStore();
  const { interrupt } = useLLMStore();

  const { openMenuFor, MenuElements } = useDrawerChatMenu({
    onMenuActiveChange,
  });

  const query = search.trim().toLowerCase();
  const isFiltering = query.length > 0;

  const sortedChats = useMemo(() => sortChatsByRecency(chats), [chats]);
  const sections = useMemo(
    () => buildChatSections(sortedChats, query, now),
    [sortedChats, query, now]
  );

  const hasNoResults = isFiltering && sections.length === 0;

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

      <ScrollView
        ref={scrollRef}
        testID="drawer-scroll"
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentOffset={initialContentOffset}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps={hasNoResults ? 'always' : 'handled'}
        automaticallyAdjustsScrollIndicatorInsets={false}
        scrollIndicatorInsets={scrollIndicatorInsets}
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
                  testID={`drawer-chat-${chat.id}`}
                  label={chatLabel(chat)}
                  active={pathname === `/chat/${chat.id}`}
                  onPress={() => openChat(chat.id)}
                  onLongPress={() => openMenuFor(chat)}
                />
              ))}
            </View>
          </View>
        ))}

        {hasNoResults && <DrawerEmptyState onNavigate={onNavigate} />}
      </ScrollView>

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
      paddingHorizontal: DRAWER_HORIZONTAL_PADDING,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingTop: 16,
      paddingBottom: theme.insets.bottom + 16,
      paddingHorizontal: DRAWER_HORIZONTAL_PADDING,
    },
    section: {
      gap: 8,
      marginBottom: SECTION_GAP,
    },
    sectionTitle: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      letterSpacing: 0.1,
      color: theme.text.defaultTertiary,
    },
  });
