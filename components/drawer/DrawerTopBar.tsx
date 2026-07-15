import React, { RefObject, useMemo } from 'react';
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
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import {
  DRAWER_HORIZONTAL_PADDING,
  getDrawerWidth,
} from '../../constants/drawer-layout';
import SearchIcon from '../../assets/icons/search.svg';
import ArrowLeftIcon from '../../assets/icons/arrow-left.svg';

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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width: screenWidth } = useWindowDimensions();

  const collapsedTitleWidth =
    getDrawerWidth(screenWidth) - DRAWER_HORIZONTAL_PADDING * 2;

  const fallbackProgress = useSharedValue(1);
  const value = progress ?? fallbackProgress;

  const titleLayerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(value.get(), [0, 0.4], [1, 0]),
  }));

  const fieldStyle = useAnimatedStyle(() => ({
    opacity: interpolate(value.get(), [0.35, 1], [0, 1]),
  }));

  if (!searching) {
    return (
      <View style={styles.bar}>
        <Text style={styles.title}>Private Mind</Text>
        <Pressable
          onPress={onOpenSearch}
          testID="drawer-search-open"
          accessibilityRole="button"
          accessibilityLabel="Search chats"
          hitSlop={12}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.pressed,
          ]}
        >
          <SearchIcon width={20} height={20} style={styles.icon} />
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
          hitSlop={12}
          style={({ pressed }) => [styles.backButton, pressed && styles.dimmed]}
        >
          <ArrowLeftIcon width={20} height={20} style={styles.icon} />
        </Pressable>
        <TextInput
          ref={inputRef}
          value={search}
          onChangeText={onChangeSearch}
          onBlur={onBlur}
          placeholder="Search chats..."
          placeholderTextColor={theme.text.defaultTertiary}
          style={styles.input}
          testID="drawer-search-input"
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
          submitBehavior="submit"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.titleLayer,
          { width: collapsedTitleWidth },
          titleLayerStyle,
        ]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={styles.title}>Private Mind</Text>
        <View style={styles.iconButton}>
          <SearchIcon width={20} height={20} style={styles.icon} />
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
    titleLayer: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.bg.softPrimary,
    },
    title: {
      flex: 1,
      paddingHorizontal: 12,
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.lg,
      color: theme.text.primary,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pressed: {
      backgroundColor: theme.bg.softSecondary,
    },
    icon: {
      color: theme.text.primary,
    },
    field: {
      flex: 1,
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
      opacity: 0.5,
    },
    input: {
      flex: 1,
      paddingVertical: 10,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
  });
