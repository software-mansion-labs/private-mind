import React, { PropsWithChildren } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { Theme } from '../styles/colors';

const BLUR_INTENSITY = 60;
const SHADOW_OPACITY = 0.1;
const SHADOW_RADIUS = 10;
const SHADOW_OFFSET_Y = 3;
const ANDROID_ELEVATION = 3;

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
}>;

const GlassSurface = ({ style, interactive = false, children }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const { borderRadius } = StyleSheet.flatten(style) ?? {};
  const fill = [styles.fill, { borderRadius }];

  let surface: React.ReactNode;
  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    surface = (
      <GlassView
        style={fill}
        glassEffectStyle="regular"
        tintColor={theme.bg.glassTint}
        isInteractive={interactive}
      >
        {children}
      </GlassView>
    );
  } else if (Platform.OS === 'ios') {
    surface = (
      <BlurView
        tint="systemThinMaterial"
        intensity={BLUR_INTENSITY}
        style={[fill, styles.tint]}
      >
        {children}
      </BlurView>
    );
  } else {
    surface = <View style={[fill, styles.fallback]}>{children}</View>;
  }

  return <View style={[styles.lift, style]}>{surface}</View>;
};

export default GlassSurface;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    lift: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border.popover,
      shadowColor: theme.bg.shadow,
      shadowOffset: { width: 0, height: SHADOW_OFFSET_Y },
      shadowOpacity: SHADOW_OPACITY,
      shadowRadius: SHADOW_RADIUS,
      elevation: ANDROID_ELEVATION,
    },
    fill: {
      flex: 1,
      alignSelf: 'stretch',
      overflow: 'hidden',
    },
    tint: {
      backgroundColor: theme.bg.glassTint,
    },
    fallback: {
      backgroundColor: theme.bg.glassFallback,
    },
  });
