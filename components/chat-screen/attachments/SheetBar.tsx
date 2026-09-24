import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import ArrowLeft from '../../../assets/icons/arrow-left.svg';
import {
  BOTTOM_BAR,
  DURATION,
  GUTTER,
  PRESS_ANYWHERE,
  panelPalette,
} from './constants';
import { Glass } from './Glass';

interface Props {
  width: number;
  top: number;
  active: boolean;
  fade: SharedValue<number>;
  onBack: () => void;
  children: ReactNode;
}

const SheetBar = ({ width, top, active, fade, onBack, children }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const backStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  return (
    <View
      pointerEvents={active ? 'box-none' : 'none'}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      style={[styles.bar, { width, top }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to menu"
        testID="attachment-sheet-back"
        onPress={onBack}
        pressRetentionOffset={PRESS_ANYWHERE}
      >
        <Glass
          radius={BOTTOM_BAR.controlSize / 2}
          active={active}
          scheme="dark"
          fade={fade}
          duration={DURATION.crossfade / 1000}
          style={styles.back}
        >
          <Animated.View style={backStyle}>
            <ArrowLeft
              width={BOTTOM_BAR.backIcon}
              height={BOTTOM_BAR.backIcon}
              style={{ color: panelPalette(theme).onControl }}
            />
          </Animated.View>
        </Glass>
      </Pressable>

      {children}
    </View>
  );
};

export default SheetBar;

const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    bar: {
      position: 'absolute',
      left: GUTTER,
      height: BOTTOM_BAR.controlSize,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: BOTTOM_BAR.inset,
    },
    back: {
      width: BOTTOM_BAR.controlSize,
      height: BOTTOM_BAR.controlSize,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
