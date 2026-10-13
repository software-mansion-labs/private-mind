import React, { type ReactNode, useEffect } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useCpuSupportStore } from '../store/cpuSupportStore';
import { UNSUPPORTED_CPU_COPY } from '../constants/cpu-support';
import { fontFamily, fontSizes, lineHeights } from '../styles/fontStyles';

const BANNER_VERTICAL_PADDING = 10;

interface Props {
  children: ReactNode;
}

const UnsupportedCpuNotice = ({ children }: Props) => {
  const lacksLseAtomics = useCpuSupportStore((state) => state.lacksLseAtomics);
  const checkCpu = useCpuSupportStore((state) => state.checkCpu);
  const insets = useSafeAreaInsets();
  const palette = useColorScheme() === 'dark' ? darkStyles : lightStyles;

  useEffect(() => {
    checkCpu();
  }, [checkCpu]);

  if (!lacksLseAtomics) return children;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.banner,
          palette.banner,
          { paddingTop: insets.top + BANNER_VERTICAL_PADDING },
        ]}
        accessibilityRole="alert"
        testID="unsupported-cpu-notice"
      >
        <Text style={[styles.title, palette.title]}>
          {UNSUPPORTED_CPU_COPY.title}
        </Text>
        <Text style={[styles.body, palette.body]}>
          {UNSUPPORTED_CPU_COPY.body}
        </Text>
      </View>
      <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
        <View style={styles.content}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
};

export default UnsupportedCpuNotice;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  banner: {
    paddingHorizontal: 16,
    paddingBottom: BANNER_VERTICAL_PADDING,
    gap: 2,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSizes.md,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.sm,
    lineHeight: lineHeights.sm,
  },
  content: {
    flex: 1,
  },
});

const lightStyles = StyleSheet.create({
  banner: { backgroundColor: '#FDE9D2' },
  title: { color: '#7A4105' },
  body: { color: '#020f3c' },
});

const darkStyles = StyleSheet.create({
  banner: { backgroundColor: '#4A2A07' },
  title: { color: '#F0A860' },
  body: { color: '#ffffff' },
});
