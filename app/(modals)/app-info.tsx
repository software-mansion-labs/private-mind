import React from 'react';
import { StyleSheet, View, Text, Pressable, Linking } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Application from 'expo-application';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSizes, fontFamily } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import GlassScreenHeader, {
  useGlassScreenHeaderHeight,
} from '../../components/GlassScreenHeader';
import SecondaryButton from '../../components/SecondaryButton';
import Logo from '../../assets/icons/logo.svg';
import GithubIcon from '../../assets/icons/github.svg';
import CopyIcon from '../../assets/icons/copy.svg';
import FooterIcon from '../../assets/icons/footer.svg';
import { pressedOpacity } from '../../styles/pressable';
import { radius, space, stroke } from '../../constants/design-system';

const APP_VERSION = `v.${Application.nativeApplicationVersion ?? ''}`;

const GITHUB_LINKS: { text: string; url: string }[] = [
  {
    text: 'Check React Native ExecuTorch',
    url: 'https://github.com/software-mansion/react-native-executorch',
  },
  {
    text: 'Check Private Mind repo',
    url: 'https://github.com/software-mansion-labs/private-mind',
  },
  {
    text: 'Check React Native RAG',
    url: 'https://github.com/software-mansion-labs/react-native-rag',
  },
];

const AppHeader = () => {
  const { theme } = useTheme();

  return (
    <View style={[styles.card, { borderColor: theme.border.soft }]}>
      <View style={styles.logoContainer}>
        <Logo width={28} height={28} />
        <Text style={[styles.appName, { color: theme.text.primary }]}>
          Private Mind
        </Text>
      </View>
      <Text style={[styles.appDescription, { color: theme.text.primary }]}>
        An app brought to you by Software Mansion to run AI models, locally on
        your device.
      </Text>
    </View>
  );
};

const LearnMoreSection = () => {
  const { theme } = useTheme();

  return (
    <View style={[styles.card, { borderColor: theme.border.soft }]}>
      <Text style={[styles.learnMoreTitle, { color: theme.text.primary }]}>
        Want to learn more?
      </Text>
      <Text
        style={[
          styles.learnMoreSubtitle,
          { color: theme.text.defaultSecondary },
        ]}
      >
        Check our other libraries related to AI.
      </Text>
      {GITHUB_LINKS.map(({ text, url }) => (
        <SecondaryButton
          key={text}
          icon={
            <GithubIcon
              width={20}
              height={20}
              style={{ color: theme.text.primary }}
            />
          }
          style={{ width: '100%' }}
          text={text}
          onPress={() => Linking.openURL(url)}
        />
      ))}
    </View>
  );
};

const VersionInfo = () => {
  const { theme } = useTheme();

  const handleCopyVersion = async () => {
    await Clipboard.setStringAsync(APP_VERSION);
    Toast.show({
      type: 'defaultToast',
      text1: 'Successfully copied version to clipboard',
    });
  };

  return (
    <View style={[styles.versionCard, { borderColor: theme.border.soft }]}>
      <Text style={[styles.versionText, { color: theme.text.primary }]}>
        App version:
      </Text>
      <View style={styles.versionInfoContainer}>
        <Text style={[styles.versionText, { color: theme.text.primary }]}>
          {APP_VERSION}
        </Text>
        <Pressable
          onPress={handleCopyVersion}
          style={({ pressed }) => pressed && pressedOpacity}
        >
          <CopyIcon
            width={16}
            height={16}
            style={{ color: theme.text.defaultTertiary }}
          />
        </Pressable>
      </View>
    </View>
  );
};

export default function AppInfoScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useGlassScreenHeaderHeight();

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg.softPrimary }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: headerHeight + 24,
            paddingBottom: insets.bottom + 16,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader />
        <LearnMoreSection />
        <VersionInfo />
        <View style={styles.footer}>
          <FooterIcon />
        </View>
      </ScrollView>
      <GlassScreenHeader title="App info" onBack={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: space.four,
    gap: space.four,
  },
  card: {
    padding: space.four,
    alignItems: 'center',
    gap: space.four,
    borderRadius: radius.twelve,
    borderWidth: stroke.soft,
  },
  versionCard: {
    padding: space.four,
    alignItems: 'center',
    gap: space.four,
    borderRadius: radius.twelve,
    borderWidth: stroke.soft,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.two,
  },
  appName: {
    fontSize: fontSizes.xxl,
    fontFamily: fontFamily.bold,
  },
  appDescription: {
    fontSize: fontSizes.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
  learnMoreTitle: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.medium,
  },
  learnMoreSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.sm,
  },
  versionInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.two,
  },
  versionText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.sm,
  },
  footer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: space.four,
  },
});
