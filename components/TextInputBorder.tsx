import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
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
  const activeOpacity = useRef(new Animated.Value(showActive ? 1 : 0)).current;
  const errorOpacity = useRef(new Animated.Value(error ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(activeOpacity, {
      toValue: showActive ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [showActive, activeOpacity]);

  useEffect(() => {
    Animated.timing(errorOpacity, {
      toValue: error ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [error, errorOpacity]);

  return (
    <>
      <View style={[styles.common, styles.inactive]} />
      <Animated.View
        style={[styles.common, styles.active, { opacity: activeOpacity }]}
      />
      <Animated.View
        style={[styles.common, styles.errorBorder, { opacity: errorOpacity }]}
      />
    </>
  );
};

export default TextInputBorder;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    common: {
      borderRadius: 12,
      pointerEvents: 'none',
      ...StyleSheet.absoluteFillObject,
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
