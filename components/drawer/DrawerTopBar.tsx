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
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import {
  DRAWER_HORIZONTAL_PADDING,
  getDrawerWidth,
} from '../../constants/drawer-layout';
import SearchField, {
  SearchFieldIcon,
  SearchFieldSurface,
} from '../SearchField';
import ArrowLeftIcon from '../../assets/icons/arrow-left.svg';
import { pressedOpacity } from '../../styles/pressable';

const BACK_ICON_SIZE = 20;

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
  const { width: screenWidth } = useWindowDimensions();

  const collapsedTitleWidth =
    getDrawerWidth(screenWidth) - DRAWER_HORIZONTAL_PADDING * 2;

  const fallbackProgress = useSharedValue(1);
  const value = progress ?? fallbackProgress;

  const pillLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(value.get(), [0, 0.4], [1, 0]),
  }));

  const fieldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(value.get(), [0.35, 1], [0, 1]),
  }));

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
            <Text style={styles.placeholder}>Search</Text>
          </SearchFieldSurface>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.grow, fieldStyle]}>
        <SearchField
          inputRef={inputRef}
          value={search}
          onChangeText={onChangeSearch}
          onBlur={onBlur}
          placeholder="Search chats..."
          testID="drawer-search-input"
          submitBehavior="submit"
          leading={
            <Pressable
              onPress={() => onCloseSearch()}
              testID="drawer-search-back"
              accessibilityRole="button"
              accessibilityLabel="Close search"
              hitSlop={12}
              style={({ pressed }) => pressed && pressedOpacity}
            >
              <ArrowLeftIcon
                width={BACK_ICON_SIZE}
                height={BACK_ICON_SIZE}
                style={styles.icon}
              />
            </Pressable>
          }
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.pillLayer,
          { width: collapsedTitleWidth },
          pillLayerStyle,
        ]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <SearchFieldSurface style={styles.grow}>
          <SearchFieldIcon />
          <Text style={styles.placeholder}>Search</Text>
        </SearchFieldSurface>
      </Animated.View>
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
    pillLayer: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.bg.softPrimary,
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
    icon: {
      color: theme.text.primary,
    },
  });
