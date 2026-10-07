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
import { TEXT_SELECTION, Theme } from '../../styles/colors';
import {
  DRAWER_HORIZONTAL_PADDING,
  getDrawerWidth,
} from '../../constants/drawer-layout';
import SearchIcon from '../../assets/icons/search.svg';
import ArrowLeftIcon from '../../assets/icons/arrow-left.svg';
import { hitSlop, iconSize, opacity } from '../../constants/design-system';

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
  const { styles, theme } = useThemedStyles(createStyles);
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
          style={({ pressed }) => [styles.pill, pressed && styles.dimmed]}
        >
          <SearchIcon
            width={iconSize.md}
            height={iconSize.md}
            style={styles.placeholderIcon}
          />
          <Text style={styles.placeholder}>Search</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.field, fieldStyle]}>
        <Pressable
          onPress={() => onCloseSearch()}
          testID="drawer-search-back"
          accessibilityRole="button"
          accessibilityLabel="Close search"
          hitSlop={hitSlop}
          style={({ pressed }) => [styles.backButton, pressed && styles.dimmed]}
        >
          <ArrowLeftIcon
            width={iconSize.md}
            height={iconSize.md}
            style={styles.icon}
          />
        </Pressable>
        <TextInput
          {...TEXT_SELECTION}
          ref={inputRef}
          value={search}
          onChangeText={onChangeSearch}
          onBlur={onBlur}
          placeholder="Search"
          placeholderTextColor={theme.text.defaultTertiary}
          style={styles.input}
          testID="drawer-search-input"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          submitBehavior="submit"
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
        <View style={styles.pill}>
          <SearchIcon
            width={iconSize.md}
            height={iconSize.md}
            style={styles.placeholderIcon}
          />
          <Text style={styles.placeholder}>Search</Text>
        </View>
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
    pill: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border.soft,
      backgroundColor: theme.bg.softSecondary,
    },
    placeholder: {
      flex: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      color: theme.text.defaultTertiary,
    },
    placeholderIcon: {
      color: theme.text.defaultTertiary,
    },
    icon: {
      color: theme.text.primary,
    },
    field: {
      flex: 1,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingLeft: 4,
      paddingRight: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border.soft,
      backgroundColor: theme.bg.softSecondary,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dimmed: {
      opacity: opacity.pressed,
    },
    input: {
      flex: 1,
      paddingVertical: 10,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
  });
