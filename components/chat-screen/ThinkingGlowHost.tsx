import React, {
  type ReactNode,
  createContext,
  useContext,
  useMemo,
} from 'react';
import { StyleSheet, View } from 'react-native';
import {
  type SharedValue,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme, isDarkTheme } from '../../styles/colors';
import ThinkingGlow from './ThinkingGlow';
import {
  GLOW_PULSE_STRENGTH,
  HIDDEN_GLOW,
  type GlowSegment,
} from './thinkingGlowMotion';

type GlowSurface = {
  segment: SharedValue<GlowSegment>;
  clock: SharedValue<number>;
};

const GlowSurfaceContext = createContext<GlowSurface | null>(null);

export const useGlowSurface = () => useContext(GlowSurfaceContext);

export default function ThinkingGlowHost({
  children,
}: {
  children: ReactNode;
}) {
  const { styles, theme } = useThemedStyles(createStyles);
  const still = useReducedMotion();
  const segment = useSharedValue<GlowSegment>(HIDDEN_GLOW);
  const clock = useSharedValue(Date.now());
  const surface = useMemo(() => ({ segment, clock }), [segment, clock]);

  return (
    <GlowSurfaceContext.Provider value={surface}>
      <View style={styles.container}>
        <ThinkingGlow
          segment={segment}
          clock={clock}
          pulseStrength={still ? 0 : GLOW_PULSE_STRENGTH}
          still={still}
          dark={isDarkTheme(theme)}
        />
        {children}
      </View>
    </GlowSurfaceContext.Provider>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
  });
