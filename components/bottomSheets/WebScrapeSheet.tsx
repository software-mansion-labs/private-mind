import React from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { SERP_PARSER_JS_ONLOAD } from '../../utils/web/scrape/serpParser';
import {
  SCRAPE_IDLE_SOURCE,
  SCRAPE_HOST_OFFSCREEN_TOP,
  SCRAPE_HOST_OFFSCREEN_HEIGHT,
} from '../../constants/web';
import { useScrapeHost } from '../../hooks/useScrapeHost';
import { isAllowedScrapeNavigation } from '../../utils/web/security/scrapeNavigation';

const WebScrapeSheet = () => {
  const { styles, theme } = useThemedStyles(createStyles);
  const {
    webRef,
    nav,
    revealed,
    closeAndCancel,
    recheck,
    handleMessage,
    handleLoadEnd,
  } = useScrapeHost();

  return (
    <View
      style={revealed ? styles.revealed : styles.hidden}
      pointerEvents={revealed ? 'auto' : 'none'}
    >
      {revealed && (
        <LinearGradient
          colors={[theme.bg.softPrimary, theme.bg.main]}
          style={StyleSheet.absoluteFill}
        />
      )}

      {revealed && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Private Mind is browsing for you
          </Text>
          <Text style={styles.headerHint}>
            Confirm you’re human to continue
          </Text>
        </View>
      )}

      <View style={revealed ? styles.frame : styles.frameOffscreen}>
        <WebView
          key={nav?.key ?? 'idle'}
          ref={webRef}
          source={nav ? { uri: nav.uri } : SCRAPE_IDLE_SOURCE}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={(request) =>
            isAllowedScrapeNavigation(request.url)
          }
          incognito
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          injectedJavaScript={SERP_PARSER_JS_ONLOAD}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          style={styles.webview}
        />
      </View>

      {revealed && (
        <View style={styles.actions}>
          <Pressable
            onPress={closeAndCancel}
            style={styles.secondaryButton}
            accessibilityRole="button"
            testID="web-challenge-cancel"
          >
            <Text style={styles.secondaryLabel}>Skip search</Text>
          </Pressable>
          <Pressable
            onPress={recheck}
            style={styles.primaryButton}
            accessibilityRole="button"
            testID="web-challenge-done"
          >
            <Text style={styles.primaryLabel}>Done</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

export default WebScrapeSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    hidden: {
      position: 'absolute',
      top: SCRAPE_HOST_OFFSCREEN_TOP,
      left: 0,
      width: '100%',
      height: SCRAPE_HOST_OFFSCREEN_HEIGHT,
    },
    revealed: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      elevation: 1000,
    },
    header: {
      paddingTop: theme.insets.top + 12,
      paddingBottom: 12,
      paddingHorizontal: 20,
      gap: 2,
    },
    headerTitle: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    headerHint: {
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.regular,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultSecondary,
    },
    frameOffscreen: {
      flex: 1,
    },
    frame: {
      flex: 1,
      marginHorizontal: 16,
      borderRadius: 16,
      overflow: 'hidden',
    },
    webview: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: theme.insets.bottom + 14,
    },
    secondaryButton: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.text.contrastTertiary,
    },
    secondaryLabel: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.medium,
      color: theme.text.contrastPrimary,
    },
    primaryButton: {
      paddingVertical: 10,
      paddingHorizontal: 22,
      borderRadius: 999,
      backgroundColor: theme.text.contrastPrimary,
    },
    primaryLabel: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.bold,
      color: theme.bg.main,
    },
  });
