import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Theme } from '../styles/colors';
import { useTheme } from '../context/ThemeContext';

interface TextInputBorderProps {
  active: boolean;
  error?: boolean;
}

/**
 * Place inside a view wrapping a text input - it'll match dimensions of its parent.
 */
const TextInputBorder: React.FC<TextInputBorderProps> = ({
  active,
  error = false,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const showActive = active && !error;
  const activeOpacity = useSharedValue(showActive ? 1 : 0);
  const errorOpacity = useSharedValue(error ? 1 : 0);

  useEffect(() => {
    activeOpacity.set(withTiming(showActive ? 1 : 0, { duration: 180 }));
  }, [showActive, activeOpacity]);

  useEffect(() => {
    errorOpacity.set(withTiming(error ? 1 : 0, { duration: 180 }));
  }, [error, errorOpacity]);

  const activeStyle = useAnimatedStyle(() => ({
    opacity: activeOpacity.get(),
  }));
  const errorStyle = useAnimatedStyle(() => ({
    opacity: errorOpacity.get(),
  }));

  return (
    <>
      <View style={[styles.common, styles.inactive]} />
      <Animated.View style={[styles.common, styles.active, activeStyle]} />
      <Animated.View style={[styles.common, styles.errorBorder, errorStyle]} />
    </>
  );
};

export default TextInputBorder;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    common: {
      borderRadius: 12,
      pointerEvents: 'none',
      ...StyleSheet.absoluteFill,
    },
    inactive: {
      borderWidth: 1,
      borderColor: theme.border.soft,
    },
    active: {
      borderWidth: 2,
      borderColor: theme.bg.strongPrimary,
    },
    errorBorder: {
      borderWidth: 2,
      borderColor: theme.text.error,
    },
  });
