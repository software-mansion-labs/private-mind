import React, { RefObject } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
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
import SearchField, {
  SEARCH_ICON_SIZE,
  SearchFieldIcon,
  SearchFieldSurface,
} from '../SearchField';
import ArrowLeftIcon from '../../assets/icons/arrow-left.svg';

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
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const fallbackProgress = useSharedValue(1);
  const value = progress ?? fallbackProgress;

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
        <Pressable
          onPress={onOpenSearch}
          testID="drawer-search-open"
          accessibilityRole="button"
          accessibilityLabel="Search chats"
          style={({ pressed }) => [styles.grow, pressed && pressedOpacity]}
        >
          <SearchFieldSurface>
            <SearchFieldIcon />
            <Text style={styles.placeholder}>{PLACEHOLDER}</Text>
          </SearchFieldSurface>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <View style={styles.grow}>
        <SearchField
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
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
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
