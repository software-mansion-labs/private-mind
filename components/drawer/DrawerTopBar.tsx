import React, { RefObject } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import GlassSurface from '../GlassSurface';
import SearchField, {
  SEARCH_ICON_SIZE,
  SearchFieldIcon,
  SearchFieldSurface,
} from '../SearchField';
import ArrowLeftIcon from '../../assets/icons/arrow-left.svg';
import { space } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import {
  DRAWER_HORIZONTAL_PADDING,
  DRAWER_SEARCH_BAR_HEIGHT,
  getDrawerWidth,
} from '../../constants/drawer-layout';

const BACK_ICON_SIZE = 20;
const ICON_FADE_OUT_END = 0.6;
const ICON_FADE_IN_START = 0.3;
const ICON_HIDDEN_SCALE = 0.6;

const PLACEHOLDER = 'Search chats...';

interface Props {
  searching: boolean;
  search: string;
  onChangeSearch: (value: string) => void;
  onOpenSearch?: () => void;
  onCloseSearch: () => void;
  onBlur?: () => void;
  inputRef?: RefObject<TextInput | null>;
  progress?: SharedValue<number>;
  expansion?: SharedValue<number>;
}

export const DrawerTopBar = ({
  searching,
  search,
  onChangeSearch,
  onOpenSearch,
  onCloseSearch,
  onBlur,
  inputRef,
  progress,
  expansion,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const fallbackProgress = useSharedValue(1);
  const value = progress ?? fallbackProgress;
  const expansionValue = expansion ?? fallbackProgress;

  const { width: screenWidth } = useWindowDimensions();
  const collapsedPillWidth =
    getDrawerWidth(screenWidth) - DRAWER_HORIZONTAL_PADDING * 2;
  const expandedPillWidth = screenWidth - DRAWER_HORIZONTAL_PADDING * 2;

  const pillStyle = useAnimatedStyle(() => ({
    width: interpolate(
      expansionValue.get(),
      [0, 1],
      [collapsedPillWidth, expandedPillWidth]
    ),
  }));

  const searchIconStyle = useAnimatedStyle(() => {
    const t = value.get();
    return {
      opacity: interpolate(
        t,
        [0, ICON_FADE_OUT_END],
        [1, 0],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          scale: interpolate(
            t,
            [0, ICON_FADE_OUT_END],
            [1, ICON_HIDDEN_SCALE],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  const backIconStyle = useAnimatedStyle(() => {
    const t = value.get();
    return {
      opacity: interpolate(
        t,
        [ICON_FADE_IN_START, 1],
        [0, 1],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          scale: interpolate(
            t,
            [ICON_FADE_IN_START, 1],
            [ICON_HIDDEN_SCALE, 1],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  if (!searching) {
    return (
      <View style={styles.bar}>
        <Animated.View style={[styles.pillSlot, pillStyle]}>
          <GlassSurface interactive style={styles.glass}>
            <Pressable
              onPress={onOpenSearch}
              testID="drawer-search-open"
              accessibilityRole="button"
              accessibilityLabel="Search chats"
              style={({ pressed }) => [styles.grow, pressed && pressedOpacity]}
            >
              <SearchFieldSurface style={styles.clearSurface}>
                <SearchFieldIcon />
                <Text
                  style={styles.placeholder}
                  numberOfLines={1}
                  maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
                >
                  {PLACEHOLDER}
                </Text>
              </SearchFieldSurface>
            </Pressable>
          </GlassSurface>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.pillSlot, pillStyle]}>
        <GlassSurface interactive style={styles.glass}>
          <SearchField
            surfaceStyle={styles.clearSurface}
            maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
            inputRef={inputRef}
            value={search}
            onChangeText={onChangeSearch}
            onBlur={onBlur}
            placeholder={PLACEHOLDER}
            accessibilityLabel="Search chats"
            testID="drawer-search-input"
            submitBehavior="submit"
            leading={
              <Pressable
                onPress={() => onCloseSearch()}
                testID="drawer-search-back"
                accessibilityRole="button"
                accessibilityLabel="Close search"
                hitSlop={12}
                style={({ pressed }) => [
                  styles.iconSlot,
                  pressed && pressedOpacity,
                ]}
              >
                <Animated.View style={[styles.iconLayer, searchIconStyle]}>
                  <SearchFieldIcon />
                </Animated.View>
                <Animated.View style={[styles.iconLayer, backIconStyle]}>
                  <ArrowLeftIcon
                    width={BACK_ICON_SIZE}
                    height={BACK_ICON_SIZE}
                    style={styles.icon}
                  />
                </Animated.View>
              </Pressable>
            }
          />
        </GlassSurface>
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.two,
      height: DRAWER_SEARCH_BAR_HEIGHT,
    },
    pillSlot: {
      height: DRAWER_SEARCH_BAR_HEIGHT,
    },
    glass: {
      flex: 1,
      height: DRAWER_SEARCH_BAR_HEIGHT,
      borderRadius: DRAWER_SEARCH_BAR_HEIGHT / 2,
    },
    clearSurface: {
      backgroundColor: 'transparent',
    },
    iconSlot: {
      width: SEARCH_ICON_SIZE,
      height: SEARCH_ICON_SIZE,
    },
    iconLayer: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    icon: {
      color: theme.text.primary,
    },
    grow: {
      flex: 1,
    },
    placeholder: {
      flex: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      color: theme.text.defaultTertiary,
    },
  });
