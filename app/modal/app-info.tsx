import React from 'react';
import {
  StyleSheet,
  Platform,
  View,
  Text,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontSizes, fontFamily } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import ModalHeader from '../../components/ModalHeader';
import SecondaryButton from '../../components/SecondaryButton';
import Logo from '../../assets/icons/logo.svg';
import GithubIcon from '../../assets/icons/github.svg';
import CopyIcon from '../../assets/icons/copy.svg';
import FooterIcon from '../../assets/icons/footer.svg';

const APP_VERSION = 'v.1.0.3';

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
        <Logo width={32} height={32} />
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

  const handleCopyVersion = () => {
    Clipboard.setString(APP_VERSION);
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
        <TouchableOpacity onPress={handleCopyVersion}>
          <CopyIcon
            width={16}
            height={16}
            style={{ color: theme.text.defaultTertiary }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function AppInfoScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg.softPrimary }]}>
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ModalHeader title="App info" onClose={() => router.back()} />
        <AppHeader />
        <LearnMoreSection />
        <VersionInfo />
        <View style={styles.footer}>
          <FooterIcon />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 16,
    alignItems: 'center',
    gap: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  versionCard: {
    padding: 16,
    alignItems: 'center',
    gap: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    gap: 8,
  },
  versionText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.sm,
  },
  footer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
});
