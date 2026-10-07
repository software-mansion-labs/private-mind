import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { iconSize, opacity, radius } from '../../constants/design-system';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { SvgComponent } from '../../utils/SvgComponent';

export const MENU_ROW = {
  regular: {
    height: 48,
    paddingHorizontal: 12,
    gap: 12,
    icon: iconSize.md,
  },
  compact: {
    height: 42,
    paddingHorizontal: 12,
    gap: 10,
    icon: iconSize.sm,
  },
} as const;

export type MenuRowVariant = keyof typeof MENU_ROW;

interface Props {
  label: string;
  icon: SvgComponent;
  onPress?: () => void;
  variant?: MenuRowVariant;
  destructive?: boolean;
  dimmed?: boolean;
  busy?: boolean;
  checked?: boolean;
  trailing?: ReactNode;
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
  checked,
  trailing,
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
  const isSwitch = checked !== undefined;

  return (
    <Pressable
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: dimmed, checked }}
      testID={testID}
      onPress={onPress}
      pressRetentionOffset={pressRetentionOffset}
      style={({ pressed }) => [
        styles.row,
        dimmed && styles.dimmed,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} style={styles.icon} />
      ) : (
        <Icon width={size} height={size} style={{ color }} />
      )}
      <Text numberOfLines={1} style={[styles.label, { color }]}>
        {label}
      </Text>
      {trailing ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {trailing}
        </View>
      ) : null}
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
      borderRadius: radius.twelve,
      borderCurve: 'continuous',
    },
    dimmed: {
      opacity: opacity.disabled,
    },
    pressed:
      variant === 'regular'
        ? { backgroundColor: theme.bg.dialogAction }
        : { opacity: opacity.pressed },
    icon: {
      width: spec.icon,
      height: spec.icon,
    },
    label: {
      flexGrow: 1,
      flexShrink: 1,
      fontFamily: fontFamily.medium,
      fontSize: variant === 'compact' ? fontSizes.sm : fontSizes.md,
      lineHeight: variant === 'compact' ? lineHeights.sm : lineHeights.md,
    },
  });
};
