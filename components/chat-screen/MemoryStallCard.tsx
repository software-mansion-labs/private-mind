import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';

export type MemoryStallFallback = {
  modelName: string;
  isDownloaded: boolean;
  isDownloading: boolean;
};

type MemoryStallCardProps = {
  stalledModelName: string;
  fallback?: MemoryStallFallback;
  disabled?: boolean;
  onAnswerWithFallback: () => void;
  onDownloadFallback: () => void;
  onTryAgain: () => void;
};

const stallExplanation = (modelName: string) =>
  `Your phone is short on memory right now, so ${modelName} is running very slowly. A smaller model can answer right away.`;

const fallbackActionLabel = (fallback: MemoryStallFallback): string => {
  if (fallback.isDownloaded) return `Answer with ${fallback.modelName}`;
  if (fallback.isDownloading) return `Downloading ${fallback.modelName}…`;
  return `Download ${fallback.modelName}`;
};

export default function MemoryStallCard({
  stalledModelName,
  fallback,
  disabled = false,
  onAnswerWithFallback,
  onDownloadFallback,
  onTryAgain,
}: MemoryStallCardProps) {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.card} testID="memory-stall-card">
      <Text style={styles.title}>This is taking longer than usual</Text>
      <Text style={styles.body}>{stallExplanation(stalledModelName)}</Text>
      <View style={styles.actions}>
        {fallback && (
          <PrimaryButton
            text={fallbackActionLabel(fallback)}
            onPress={
              fallback.isDownloaded ? onAnswerWithFallback : onDownloadFallback
            }
            disabled={disabled || fallback.isDownloading}
          />
        )}
        <SecondaryButton
          text="Try again"
          onPress={onTryAgain}
          disabled={disabled}
        />
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      width: '100%',
      backgroundColor: theme.bg.cardSurface,
      borderRadius: 16,
      padding: 16,
      gap: 8,
      marginBottom: 24,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
    body: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultSecondary,
    },
    actions: {
      marginTop: 8,
      gap: 8,
    },
  });
