import React, { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import ArrowLeft from '../../../assets/icons/arrow-left.svg';
import { BOTTOM_BAR, DURATION, GUTTER, panelPalette } from './constants';
import { Glass } from './Glass';

interface Props {
  width: number;
  /**
   * Window Y of the bar's top edge. Positioned off the same numbers as the
   * panel rather than by `bottom`: the panel is placed absolutely in window
   * coordinates while this sits in the over-keyboard view, and on Android the
   * two disagree by the navigation bar.
   */
  top: number;
  /** Whether the controls are wearing their glass and taking touches. */
  active: boolean;
  /** Fades the glyphs with the sheet. The glass itself cannot be faded, but
   *  anything drawn inside it can. */
  fade: SharedValue<number>;
  onBack: () => void;
  /** The sheet's own controls, filling the bar to the right of the ‹. */
  children: ReactNode;
}

/**
 * The row of controls floating over a sheet. Deliberately not part of either
 * sheet and not part of the panel: these are glass, and the sheet's subtree has
 * its opacity animated through the morph, which would leave them rendering as
 * nothing. Nothing in here clips — a glass control draws its rim and press
 * bulge outside its own bounds.
 */
const SheetBar = ({ width, top, active, fade, onBack, children }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const backStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  return (
    <View
      pointerEvents={active ? 'box-none' : 'none'}
      style={[styles.bar, { width, top }]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to menu"
        testID="attachment-sheet-back"
        onPress={onBack}
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
      // The controls belong to the sheet, so they sit inside its edges rather
      // than the screen's. `top` comes from the caller — see the prop.
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
