import React, { PropsWithChildren } from 'react';
import {
  AccessibilityRole,
  LayoutChangeEvent,
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
import { useBackToDismiss } from '../../hooks/useBackToDismiss';
import { MENU } from '../chat-screen/attachments/constants';
import { Theme } from '../../styles/colors';
import { Glass, LIQUID_GLASS } from '../Glass';

export const POPOVER_WIDTH = 300;
const FADE_IN_MS = 150;
const GLASS_APPEAR_MS = 250;

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
  onLayout?: (event: LayoutChangeEvent) => void;
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
  onLayout,
  children,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  useBackToDismiss(visible, onClose);

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
        entering={LIQUID_GLASS ? undefined : FadeIn.duration(FADE_IN_MS)}
        style={[styles.position, anchor]}
        onLayout={onLayout}
      >
        <Glass
          radius={MENU.radius}
          interactive={false}
          duration={GLASS_APPEAR_MS / 1000}
          fallbackTint={theme.bg.popover}
          accessibilityRole={accessibilityRole}
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          testID={testID}
        >
          <Animated.View
            entering={
              LIQUID_GLASS ? FadeIn.duration(GLASS_APPEAR_MS) : undefined
            }
            style={[styles.card, contentStyle]}
          >
            {children}
          </Animated.View>
        </Glass>
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
    position: {
      position: 'absolute',
      width: POPOVER_WIDTH,
    },
    card: {
      borderRadius: MENU.radius,
      borderCurve: 'continuous',
      overflow: 'hidden',
    },
  });
