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
  didNotStart?: boolean;
  fallback?: MemoryStallFallback;
  disabled?: boolean;
  onAnswerWithFallback: () => void;
  onDownloadFallback: () => void;
  onTryAgain: () => void;
};

const cardCopy = (modelName: string, didNotStart: boolean) =>
  didNotStart
    ? {
        title: `${modelName} couldn't start`,
        body: `Last time your phone ran out of memory while ${modelName} was starting, and the app closed. A smaller model can answer right away.`,
      }
    : {
        title: 'This is taking longer than usual',
        body: `Your phone is short on memory right now, so ${modelName} is running very slowly. A smaller model can answer right away.`,
      };

const fallbackActionLabel = (fallback: MemoryStallFallback): string => {
  if (fallback.isDownloaded) return `Answer with ${fallback.modelName}`;
  if (fallback.isDownloading) return `Downloading ${fallback.modelName}…`;
  return `Download ${fallback.modelName}`;
};

export default function MemoryStallCard({
  stalledModelName,
  didNotStart = false,
  fallback,
  disabled = false,
  onAnswerWithFallback,
  onDownloadFallback,
  onTryAgain,
}: MemoryStallCardProps) {
  const { styles } = useThemedStyles(createStyles);
  const copy = cardCopy(stalledModelName, didNotStart);

  return (
    <View style={styles.card} testID="memory-stall-card">
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
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
