import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import ArrowLeftIcon from '../../assets/icons/arrow-left.svg';

export interface OnboardingStepPanelProps {
  label: string;
  title: string;
  description: string;
  buttonLabel: string;
  onBackPress?: () => void;
  onNextPress: () => void;
  buttonPrimary: boolean;
}

function OnboardingStepPanel({
  label,
  title,
  description,
  buttonLabel,
  onBackPress,
  onNextPress,
  buttonPrimary,
}: OnboardingStepPanelProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <View style={styles.labelBadge}>
          <Text style={styles.labelText}>{label}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={styles.buttonRow}>
        {onBackPress && (
          <View style={styles.backButton}>
            <SecondaryButton
              text=""
              onPress={onBackPress}
              icon={
                <ArrowLeftIcon
                  color={theme.text.primary}
                  width={24}
                  height={24}
                />
              }
            />
          </View>
        )}
        <View style={styles.nextButton}>
          {buttonPrimary ? (
            <PrimaryButton text={buttonLabel} onPress={onNextPress} />
          ) : (
            <SecondaryButton
              text={buttonLabel}
              onPress={onNextPress}
              textStyle={styles.nextButtonText}
            />
          )}
        </View>
      </View>
    </View>
  );
}

export default OnboardingStepPanel;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.bg.softPrimary,
      padding: 16,
      borderRadius: 18,
      gap: 24,
    },

    textContainer: {
      alignItems: 'center',
      gap: 16,
    },
    labelBadge: {
      backgroundColor: theme.bg.softSecondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    labelText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      textAlign: 'center',
      color: theme.text.primary,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.lg,
      lineHeight: lineHeights.lg,
      textAlign: 'center',
      color: theme.text.primary,
    },
    description: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      textAlign: 'center',
      color: theme.text.defaultSecondary,
    },

    buttonRow: {
      flexDirection: 'row',
      gap: 8,
    },
    backButton: {
      width: 48,
    },
    nextButton: {
      flex: 1,
    },
    nextButtonText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
    },
  });
