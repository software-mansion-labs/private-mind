import React, { type ReactNode, useEffect } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import {
  SafeAreaInsetsContext,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useCpuSupportStore } from '../store/cpuSupportStore';
import { UNSUPPORTED_CPU_COPY } from '../constants/cpu-support';
import { fontFamily, fontSizes, lineHeights } from '../styles/fontStyles';
import WarningIcon from '../assets/icons/warning-triangle.svg';

const BANNER_VERTICAL_PADDING = 10;
const WARNING_ICON_SIZE = 20;

const LIGHT_COLORS = {
  background: '#FDE9D2',
  accent: '#B8630A',
  title: '#7A4105',
  body: '#020f3c',
};

const DARK_COLORS = {
  background: '#4A2A07',
  accent: '#F0A860',
  title: '#F0A860',
  body: '#ffffff',
};

interface Props {
  children: ReactNode;
}

const UnsupportedCpuNotice = ({ children }: Props) => {
  const lacksLseAtomics = useCpuSupportStore((state) => state.lacksLseAtomics);
  const checkCpu = useCpuSupportStore((state) => state.checkCpu);
  const insets = useSafeAreaInsets();
  const colors = useColorScheme() === 'dark' ? DARK_COLORS : LIGHT_COLORS;

  useEffect(() => {
    checkCpu();
  }, [checkCpu]);

  if (!lacksLseAtomics) return children;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.banner,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + BANNER_VERTICAL_PADDING,
          },
        ]}
        accessibilityRole="alert"
        testID="unsupported-cpu-notice"
      >
        <WarningIcon
          width={WARNING_ICON_SIZE}
          height={WARNING_ICON_SIZE}
          color={colors.accent}
          style={styles.icon}
        />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.title }]}>
            {UNSUPPORTED_CPU_COPY.title}
          </Text>
          <Text style={[styles.body, { color: colors.body }]}>
            {UNSUPPORTED_CPU_COPY.body}
          </Text>
        </View>
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
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: BANNER_VERTICAL_PADDING,
    gap: 12,
  },
  icon: {
    marginTop: 1,
  },
  copy: {
    flex: 1,
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
