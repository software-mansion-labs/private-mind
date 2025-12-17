import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { fontSizes, fontFamily, lineHeights } from '../../styles/fontStyles';
import { useDetourContext } from '@swmansion/react-native-detour';
import PrimaryButton from '../../components/PrimaryButton';

// Demo chat screen shown when navigated via specific Detour link
export default function DetourDemoChat() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { deferredLink } = useDetourContext();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.scrollContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Hero Section */}
          <View style={styles.hero}>
            <Text style={styles.emoji}>🚀</Text>
            <Text style={styles.heroTitle}>Detour link success!</Text>
            <Text style={styles.subtitle}>
              You've been seamlessly redirected to this chat.
            </Text>
            <Text style={styles.subtitle}>
              This is a special showcase screen that demonstrates Detour's
              deferred deep linking.
            </Text>
          </View>

          {/* Technical Details */}
          {deferredLink && (
            <View style={[styles.card, styles.techCard]}>
              <Text style={styles.cardTitle}>🔗 Link details</Text>
              <Text style={styles.techText}>
                Original link:{'\n'}
                <Text style={styles.linkText}>{deferredLink.toString()}</Text>
              </Text>
              <Text style={styles.techText}>
                Route: <Text style={styles.linkText}>/chat/detour-demo</Text>
              </Text>
            </View>
          )}

          {/* Powered By */}
          <View style={styles.poweredBy}>
            <Text style={styles.poweredByText}>Powered by</Text>
            <Text style={styles.detourBrand}>Detour SDK</Text>
            <Text style={styles.poweredBySubtext}>by Software Mansion</Text>
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <PrimaryButton
            text="Explore PrivateMind"
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      paddingBottom: theme.insets.bottom,
      backgroundColor: theme.bg.softPrimary,
    },
    content: {
      flex: 1,
      gap: 24,
      paddingTop: 24,
    },
    header: {
      gap: 12,
      paddingHorizontal: 20,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xl,
      textAlign: 'center',
      color: theme.text.primary,
    },
    description: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
      textAlign: 'center',
    },
    scrollContent: {
      paddingBottom: 20,
    },
    hero: {
      alignItems: 'center',
      marginBottom: 16,
      paddingVertical: 20,
    },
    emoji: {
      fontSize: 64,
      marginBottom: 16,
    },
    heroTitle: {
      fontSize: fontSizes.xxl,
      fontFamily: fontFamily.bold,
      color: theme.text.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
      textAlign: 'center',
      lineHeight: lineHeights.md,
    },
    card: {
      backgroundColor: theme.bg.softSecondary,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border.soft,
    },
    techCard: {
      backgroundColor: theme.bg.softSecondary,
    },
    cardTitle: {
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.bold,
      color: theme.text.primary,
      marginBottom: 12,
    },
    techText: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
      lineHeight: lineHeights.md,
    },
    linkText: {
      fontFamily: fontFamily.medium,
      color: theme.bg.main,
    },
    poweredBy: {
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 20,
    },
    poweredByText: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
      marginBottom: 4,
    },
    detourBrand: {
      fontSize: fontSizes.xl,
      fontFamily: fontFamily.bold,
      color: theme.text.primary,
      marginBottom: 2,
    },
    poweredBySubtext: {
      fontSize: fontSizes.xs,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
    footer: {
      gap: 10,
      backgroundColor: theme.bg.softPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 10,
    },
  });
