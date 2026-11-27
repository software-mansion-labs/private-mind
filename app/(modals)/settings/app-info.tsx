import React from 'react';
import { StyleSheet, View, Text, Pressable, Linking } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily } from '../../../styles/fontStyles';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import GlassScreenHeader, {
  useGlassScreenHeaderHeight,
} from '../../../components/GlassScreenHeader';
import { SettingsGroup } from '../../../components/settings/SettingsGroup';
import { SettingsRow } from '../../../components/settings/SettingsRow';
import Logo from '../../../assets/icons/logo.svg';
import GithubIcon from '../../../assets/icons/github.svg';
import CopyIcon from '../../../assets/icons/copy.svg';
import InfoCircleIcon from '../../../assets/icons/info-circle.svg';
import SwmLogo from '../../../assets/icons/swm-ai-labs-logo.svg';
import RneLogo from '../../../assets/icons/rne-logo.svg';
import { pressedOpacity } from '../../../styles/pressable';
import {
  APP_INFO_SWM_URL,
  OPENS_IN_BROWSER_HINT,
  SWM_AI_LABS_NAME,
} from '../../../constants/model-attribution';
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../../constants/design-system';
import { currentAppVersion } from '../../../utils/appVersion';

const APP_VERSION = `v${currentAppVersion()}`;

const ROW_ICON_SIZE = 20;
const ACCESSORY_ICON_SIZE = 16;
const HERO_LOGO_SIZE = 48;
const FOOTER_LOGO_COLOR = '#e6e7eb';
const FOOTER_HEIGHT = 80;
const SWM_LOGO_SIZE = { width: 100, height: 32 };
const RNE_LOGO_SIZE = { width: 116.5, height: 32.5 };
const FOOTER_SEPARATOR_HEIGHT = 21;

const GITHUB_LINKS: { text: string; url: string }[] = [
  {
    text: 'React Native ExecuTorch',
    url: 'https://github.com/software-mansion/react-native-executorch',
  },
  {
    text: 'Private Mind',
    url: 'https://github.com/software-mansion-labs/private-mind',
  },
  {
    text: 'React Native RAG',
    url: 'https://github.com/software-mansion-labs/react-native-rag',
  },
];

const handleCopyVersion = async () => {
  await Clipboard.setStringAsync(APP_VERSION);
  Toast.show({
    type: 'defaultToast',
    text1: 'Successfully copied version to clipboard',
  });
};

export default function AppInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useGlassScreenHeaderHeight(true);
  const { styles } = useThemedStyles(createStyles);

  const handleOpenSwmAiLabs = () => Linking.openURL(APP_INFO_SWM_URL);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: headerHeight + space.six,
            paddingBottom: insets.bottom + space.four,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Logo width={HERO_LOGO_SIZE} height={HERO_LOGO_SIZE} />
          <Text style={styles.appName} accessibilityRole="header">
            Private Mind
          </Text>
          <Text style={styles.appDescription}>
            An app brought to you by Software Mansion AI Labs to run AI models,
            locally on your device.
          </Text>
        </View>
        <SettingsGroup
          title="Want to learn more?"
          description="Check our other libraries related to AI."
        >
          {GITHUB_LINKS.map(({ text, url }) => (
            <SettingsRow
              key={text}
              label={text}
              icon={
                <GithubIcon
                  width={ROW_ICON_SIZE}
                  height={ROW_ICON_SIZE}
                  style={styles.rowIcon}
                />
              }
              showChevron
              accessibilityRole="link"
              accessibilityHint={OPENS_IN_BROWSER_HINT}
              onPress={() => Linking.openURL(url)}
            />
          ))}
        </SettingsGroup>
        <SettingsGroup title="About">
          <SettingsRow
            label="App version"
            icon={
              <InfoCircleIcon
                width={ROW_ICON_SIZE}
                height={ROW_ICON_SIZE}
                style={styles.rowIcon}
              />
            }
            value={APP_VERSION}
            accessory={
              <CopyIcon
                width={ACCESSORY_ICON_SIZE}
                height={ACCESSORY_ICON_SIZE}
                style={styles.accessoryIcon}
              />
            }
            accessibilityLabel={`App version ${APP_VERSION}`}
            accessibilityHint="Copies the version"
            onPress={handleCopyVersion}
            testID="app-info-version"
          />
        </SettingsGroup>
        <View style={styles.footer}>
          <View style={styles.footerLogos}>
            <Pressable
              onPress={handleOpenSwmAiLabs}
              accessibilityRole="link"
              accessibilityLabel={SWM_AI_LABS_NAME}
              accessibilityHint={OPENS_IN_BROWSER_HINT}
              style={({ pressed }) => pressed && pressedOpacity}
            >
              <SwmLogo {...SWM_LOGO_SIZE} style={styles.footerLogo} />
            </Pressable>
            <View style={styles.footerSeparator} />
            <RneLogo {...RNE_LOGO_SIZE} style={styles.footerLogo} />
          </View>
        </View>
      </ScrollView>
      <GlassScreenHeader title="App info" onBack={() => router.back()} sheet />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    rowIcon: {
      color: theme.text.primary,
    },
    accessoryIcon: {
      color: theme.text.defaultTertiary,
    },
    container: {
      flexGrow: 1,
      paddingHorizontal: space.four,
      gap: space.six,
    },
    hero: {
      alignItems: 'center',
      gap: space.two,
      paddingHorizontal: space.four,
    },
    appName: {
      ...textStyles.titleH1,
      marginTop: space.one,
      color: theme.text.primary,
    },
    appDescription: {
      ...textStyles.bodySecondaryRegular,
      fontFamily: fontFamily.regular,
      textAlign: 'center',
      color: theme.text.defaultSecondary,
    },
    footer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: space.four,
    },
    footerLogos: {
      height: FOOTER_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
    },
    footerLogo: {
      color: FOOTER_LOGO_COLOR,
    },
    footerSeparator: {
      width: stroke.soft,
      height: FOOTER_SEPARATOR_HEIGHT,
      marginLeft: space.four + space.half,
      marginRight: space.three + space.half,
      borderRadius: radius.full,
      backgroundColor: FOOTER_LOGO_COLOR,
    },
  });
