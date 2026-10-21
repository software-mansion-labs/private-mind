import React, { PropsWithChildren } from 'react';
import {
  AccessibilityRole,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { OverKeyboardView } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { radius, stroke } from '../../constants/design-system';
import { Theme } from '../../styles/colors';

export const POPOVER_WIDTH = 300;
const FADE_IN_MS = 150;
const SHADOW_OPACITY = 0.18;
const SHADOW_RADIUS = 20;
const SHADOW_OFFSET_Y = 12;
const ANDROID_ELEVATION = 8;

export interface PopoverAnchor {
  top?: number;
  bottom?: number;
  left: number;
}

type Props = PropsWithChildren<{
  visible: boolean;
  anchor: PopoverAnchor;
  onClose: () => void;
  closeLabel: string;
  backdropTestID: string;
  accessibilityLabel: string;
  accessibilityRole?: AccessibilityRole;
  testID: string;
  contentStyle?: StyleProp<ViewStyle>;
  hostsTextInput?: boolean;
}>;

const Popover = ({
  visible,
  anchor,
  onClose,
  closeLabel,
  backdropTestID,
  accessibilityLabel,
  accessibilityRole,
  testID,
  contentStyle,
  hostsTextInput = false,
  children,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  const content = visible ? (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        entering={FadeIn.duration(FADE_IN_MS)}
        style={StyleSheet.absoluteFill}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, styles.scrim]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          testID={backdropTestID}
        />
      </Animated.View>
      <Animated.View
        entering={FadeIn.duration(FADE_IN_MS)}
        style={[styles.shadow, anchor]}
      >
        <View
          style={[styles.card, contentStyle]}
          accessibilityRole={accessibilityRole}
          accessibilityLabel={accessibilityLabel}
          testID={testID}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  ) : null;

  if (hostsTextInput && Platform.OS === 'android') {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={onClose}
      >
        {content}
      </Modal>
    );
  }

  return <OverKeyboardView visible={visible}>{content}</OverKeyboardView>;
};

export default Popover;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    scrim: {
      backgroundColor: theme.bg.popoverScrim,
    },
    shadow: {
      position: 'absolute',
      width: POPOVER_WIDTH,
      borderRadius: radius.eighteen,
      shadowColor: theme.bg.shadow,
      shadowOffset: { width: 0, height: SHADOW_OFFSET_Y },
      shadowOpacity: SHADOW_OPACITY,
      shadowRadius: SHADOW_RADIUS,
      elevation: ANDROID_ELEVATION,
    },
    card: {
      borderRadius: radius.eighteen,
      borderWidth: stroke.soft,
      borderColor: theme.border.popover,
      backgroundColor: theme.bg.popover,
      overflow: 'hidden',
    },
  });
