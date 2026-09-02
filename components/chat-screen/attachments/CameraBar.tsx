import type { FlashMode } from 'expo-camera';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import { Feedback } from '../../../utils/Feedback';
import { SvgComponent } from '../../../utils/SvgComponent';
import CloseIcon from '../../../assets/icons/close.svg';
import FlashIcon from '../../../assets/icons/flash.svg';
import FlashOffIcon from '../../../assets/icons/flash_off.svg';
import MoreIcon from '../../../assets/icons/more_horizontal.svg';
import RotateIcon from '../../../assets/icons/rotate_left.svg';
import {
  BOTTOM_BAR,
  CAMERA,
  DURATION,
  SPRING,
  panelPalette,
} from './constants';
import { Glass } from './Glass';
import SheetBar from './SheetBar';

interface OptionProps {
  /** 1 for the option directly above ⋯, 2 for the one above that. */
  index: number;
  label: string;
  icon: SvgComponent;
  /** 0 folded into the ⋯ button → 1 sitting in its own place above it. */
  unfold: SharedValue<number>;
  active: boolean;
  fade: SharedValue<number>;
  onPress: () => void;
  testID: string;
}

/**
 * One of the buttons that come out of the ⋯. It is laid out exactly where the ⋯
 * is and then moved: `unfold` carries it up and scales it from a fraction of
 * its size. The glass rides the transform, which is one of the things a
 * GlassView is fine under, and comes in on its own native ramp.
 */
const Option = ({
  index,
  label,
  icon: Icon,
  unfold,
  active,
  fade,
  onPress,
  testID,
}: OptionProps) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const rise = index * (BOTTOM_BAR.controlSize + CAMERA.optionGap);

  const style = useAnimatedStyle(() => {
    const u = unfold.get();
    return {
      transform: [
        { translateY: -rise * u },
        {
          scale: interpolate(
            u,
            [0, 1],
            [CAMERA.optionStartScale, 1],
            // The spring overshoots on the way in and the button is allowed to
            // as well. It is not allowed to invert on the way out.
            Extrapolation.EXTEND
          ),
        },
      ],
    };
  });

  // Clamped where the transform is not: an opacity past 1 is an error where a
  // scale past 1 is a bounce.
  const iconStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(unfold.get(), [0.2, 0.8], [0, 1], Extrapolation.CLAMP) *
      fade.get(),
  }));

  return (
    <Animated.View
      pointerEvents={active ? 'auto' : 'none'}
      style={[styles.option, style]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
        onPress={onPress}
      >
        <Glass
          radius={BOTTOM_BAR.controlSize / 2}
          active={active}
          duration={DURATION.crossfade / 1000}
          style={styles.round}
        >
          <Animated.View style={iconStyle}>
            <Icon
              width={CAMERA.optionIcon}
              height={CAMERA.optionIcon}
              style={{ color: panelPalette(theme).text }}
            />
          </Animated.View>
        </Glass>
      </Pressable>
    </Animated.View>
  );
};

interface Props {
  width: number;
  active: boolean;
  fade: SharedValue<number>;
  flash: FlashMode;
  onBack: () => void;
  onCapture: () => void;
  onFlip: () => void;
  onToggleFlash: () => void;
}

/**
 * The shutter and the ⋯ that float over the camera, on the `SheetBar` the
 * grid's controls share. The ⋯ unfolds two options straight up out of itself on
 * the panel's own springs, and reads as an ✕ while they are out.
 */
const CameraBar = ({
  width,
  active,
  fade,
  flash,
  onBack,
  onCapture,
  onFlip,
  onToggleFlash,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const unfold = useSharedValue(0);

  const toggleOptions = useCallback(() => {
    Feedback.toggleOn();
    setOpen((was) => {
      unfold.set(withSpring(was ? 0 : 1, was ? SPRING.panelOut : SPRING.panel));
      return !was;
    });
  }, [unfold]);

  const contentStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  // ⋯ ⇄ ✕, crossfading in place with a quarter turn so the swap reads as one
  // glyph turning rather than two trading.
  const dotsStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(unfold.get(), [0, 0.5], [1, 0], Extrapolation.CLAMP) *
      fade.get(),
  }));
  const closeStyle = useAnimatedStyle(() => {
    const u = unfold.get();
    return {
      opacity:
        interpolate(u, [0.3, 0.8], [0, 1], Extrapolation.CLAMP) * fade.get(),
      transform: [{ rotate: `${interpolate(u, [0, 1], [-90, 0])}deg` }],
    };
  });

  return (
    <SheetBar width={width} active={active} fade={fade} onBack={onBack}>
      {/* The shutter: a glass ring with a disc set into it. The disc is a child
          of the material, so it fades with the sheet while the ring switches
          its material natively. */}
      <View pointerEvents="box-none" style={styles.shutterSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          testID="camera-shutter"
          onPress={onCapture}
        >
          <Glass
            radius={CAMERA.shutterSize / 2}
            active={active}
            duration={DURATION.crossfade / 1000}
            style={styles.shutter}
          >
            <Animated.View style={[styles.shutterDisc, contentStyle]} />
          </Glass>
        </Pressable>
      </View>

      {/* The options render before the ⋯ so it stays on top for the frames they
          still overlap it. */}
      <View style={styles.more}>
        <Option
          index={2}
          label={flash === 'off' ? 'Turn flash on' : 'Turn flash off'}
          icon={flash === 'off' ? FlashOffIcon : FlashIcon}
          unfold={unfold}
          active={active && open}
          fade={fade}
          onPress={onToggleFlash}
          testID="camera-flash"
        />
        <Option
          index={1}
          label="Flip camera"
          icon={RotateIcon}
          unfold={unfold}
          active={active && open}
          fade={fade}
          onPress={onFlip}
          testID="camera-flip"
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? 'Hide camera options' : 'Camera options'}
          accessibilityState={{ expanded: open }}
          testID="camera-options"
          onPress={toggleOptions}
        >
          <Glass
            radius={BOTTOM_BAR.controlSize / 2}
            active={active}
            duration={DURATION.crossfade / 1000}
            style={styles.round}
          >
            <Animated.View style={[styles.glyph, dotsStyle]}>
              <MoreIcon
                width={CAMERA.optionIcon}
                height={CAMERA.optionIcon}
                style={{ color: panelPalette(theme).text }}
              />
            </Animated.View>
            <Animated.View style={[styles.glyph, closeStyle]}>
              <CloseIcon
                width={BOTTOM_BAR.backIcon}
                height={BOTTOM_BAR.backIcon}
                style={{ color: panelPalette(theme).text }}
              />
            </Animated.View>
          </Glass>
        </Pressable>
      </View>
    </SheetBar>
  );
};

export default CameraBar;

const createStyles = (theme: Theme) => {
  const palette = panelPalette(theme);
  return StyleSheet.create({
    round: {
      width: BOTTOM_BAR.controlSize,
      height: BOTTOM_BAR.controlSize,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glyph: {
      position: 'absolute',
    },
    shutterSlot: {
      // Centred on the bar's line: taller than the bar, so it is pulled up by
      // half the difference rather than hanging off its top edge.
      position: 'absolute',
      left: 0,
      right: 0,
      top: (BOTTOM_BAR.controlSize - CAMERA.shutterSize) / 2,
      alignItems: 'center',
    },
    shutter: {
      width: CAMERA.shutterSize,
      height: CAMERA.shutterSize,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterDisc: {
      width: CAMERA.shutterSize - CAMERA.shutterPadding * 2,
      height: CAMERA.shutterSize - CAMERA.shutterPadding * 2,
      borderRadius: (CAMERA.shutterSize - CAMERA.shutterPadding * 2) / 2,
      backgroundColor: palette.text,
    },
    more: {
      width: BOTTOM_BAR.controlSize,
      height: BOTTOM_BAR.controlSize,
    },
    option: {
      // Over the ⋯ exactly; `unfold` is what moves it off.
      position: 'absolute',
      left: 0,
      top: 0,
    },
  });
};
