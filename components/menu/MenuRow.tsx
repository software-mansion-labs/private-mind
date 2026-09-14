import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { radius } from '../../constants/design-system';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { SvgComponent } from '../../utils/SvgComponent';

/**
 * The one row spec for "pick an action from a short list": an icon, a label,
 * nothing else. Two sizes, not five.
 *
 * - `regular` — the option sheets and the attachment panel: a 44pt square well
 *   on `bg.softSecondary`, a 24pt glyph, the `md` label.
 * - `compact` — the small card that floats next to a message: no well, a 16pt
 *   glyph, the `sm` label.
 *
 * A row paints no background and never measures itself. Its height is fixed
 * here so a container can lay rows out from these numbers alone — the
 * attachment panel scales its rows through a morph and would fight anything
 * that sized or animated itself.
 */
export const MENU_ROW = {
  regular: {
    height: 76,
    paddingHorizontal: 8,
    gap: 16,
    well: 44,
    wellRadius: radius.twelve,
    icon: 24,
  },
  compact: {
    height: 42,
    paddingHorizontal: 12,
    gap: 10,
    icon: 16,
  },
} as const;

export type MenuRowVariant = keyof typeof MENU_ROW;

interface Props {
  label: string;
  icon: SvgComponent;
  onPress?: () => void;
  variant?: MenuRowVariant;
  /** Destructive rows take the error colour for glyph and label. */
  destructive?: boolean;
  /** Present but unavailable: dimmed, and still pressable so the caller can
   *  say why. */
  dimmed?: boolean;
  /** Waiting on what the row started: a spinner stands in for the glyph. */
  busy?: boolean;
  /** How far the finger may stray before the press is dropped. Rows in a
   *  container whose position is animated need this — see `PRESS_ANYWHERE`. */
  pressRetentionOffset?: PressableProps['pressRetentionOffset'];
  accessibilityLabel?: string;
  testID?: string;
}

const MenuRow = ({
  label,
  icon: Icon,
  onPress,
  variant = 'regular',
  destructive = false,
  dimmed = false,
  busy = false,
  pressRetentionOffset,
  accessibilityLabel,
  testID,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles, variant);
  const color = destructive
    ? theme.text.error
    : variant === 'compact'
      ? theme.text.onChatBar
      : theme.text.primary;
  const size = MENU_ROW[variant].icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: dimmed }}
      testID={testID}
      onPress={onPress}
      pressRetentionOffset={pressRetentionOffset}
      style={({ pressed }) => [
        styles.row,
        dimmed && styles.dimmed,
        pressed && styles.pressed,
      ]}
    >
      {variant === 'regular' ? (
        <View style={styles.well}>
          {busy ? (
            <ActivityIndicator color={color} />
          ) : (
            <Icon width={size} height={size} style={{ color }} />
          )}
        </View>
      ) : (
        <Icon width={size} height={size} style={{ color }} />
      )}
      {/* The row's height is fixed here so a container can lay rows out from
          these numbers alone, so a long label is clipped rather than wrapped. */}
      <Text numberOfLines={1} style={[styles.label, { color }]}>
        {label}
      </Text>
    </Pressable>
  );
};

export default MenuRow;

const createStyles = (theme: Theme, variant: MenuRowVariant) => {
  const spec = MENU_ROW[variant];
  return StyleSheet.create({
    row: {
      height: spec.height,
      paddingHorizontal: spec.paddingHorizontal,
      gap: spec.gap,
      flexDirection: 'row',
      alignItems: 'center',
    },
    dimmed: {
      opacity: 0.4,
    },
    pressed: {
      opacity: 0.6,
    },
    well: {
      width: MENU_ROW.regular.well,
      height: MENU_ROW.regular.well,
      borderRadius: MENU_ROW.regular.wellRadius,
      backgroundColor: theme.bg.softSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: variant === 'compact' ? fontSizes.sm : fontSizes.md,
      lineHeight: variant === 'compact' ? lineHeights.sm : lineHeights.md,
    },
  });
};
