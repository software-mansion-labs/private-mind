import React, { useMemo } from 'react';
import { StyleSheet, Text, TextComponent, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import PrimaryButton from '../PrimaryButton';
import TextLogo from '../../assets/text_logo.svg';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';

interface Props {
  onPressStart: () => void;
}

function OnboardingIntroPanel({ onPressStart }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View>
      <View style={styles.textContainer}>
        <TextLogo width={126} height={20} fill={theme.text.defaultTertiary} />
        <Text style={[styles.text, styles.line1]}>Your private AI mind.</Text>
        <Text style={[styles.text, styles.line2]}>In your pocket.</Text>
      </View>
      <PrimaryButton text="Get Started" onPress={onPressStart} />
    </View>
  );
}

export default OnboardingIntroPanel;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    textContainer: {
      alignItems: 'center',
      marginBottom: 48,
    },
    text: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xxl,
      lineHeight: lineHeights.xxl,
    },
    line1: {
      marginTop: 20,
      color: theme.text.primary,
    },
    line2: {
      color: theme.bg.main,
    },
  });
