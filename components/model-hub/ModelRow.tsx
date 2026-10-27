import React from 'react';
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type AccessibilityRole,
  type AccessibilityState,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { space } from '../../constants/design-system';
import { pressedOpacity } from '../../styles/pressable';

export type ModelRowAlign = 'center' | 'top';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  align?: ModelRowAlign;
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  accessible?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
  testID?: string;
}

const ModelRow = ({
  children,
  onPress,
  disabled,
  align = 'center',
  style,
  pressedStyle = pressedOpacity,
  ...accessibility
}: Props) => {
  const rowStyle = [styles.row, align === 'top' && styles.top, style];

  if (!onPress) {
    return (
      <View style={rowStyle} {...accessibility}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [rowStyle, pressed && pressedStyle]}
      onPress={onPress}
      disabled={disabled}
      {...accessibility}
    >
      {children}
    </Pressable>
  );
};

export default ModelRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.three,
  },
  top: {
    alignItems: 'flex-start',
  },
});
