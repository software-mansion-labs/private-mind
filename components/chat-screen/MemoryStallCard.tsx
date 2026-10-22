import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { radius, space, textStyles } from '../../constants/design-system';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';

type MemoryStallCardProps = {
  stalledModelName: string;
  disabled?: boolean;
  onStartNewChat: () => void;
  onTryAgain: () => void;
};

const stallExplanation = (modelName: string) =>
  `Your phone is short on memory right now, so ${modelName} is running very slowly. A smaller model in a new chat can answer right away.`;

export default function MemoryStallCard({
  stalledModelName,
  disabled = false,
  onStartNewChat,
  onTryAgain,
}: MemoryStallCardProps) {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.card} testID="memory-stall-card">
      <Text style={styles.title}>This is taking longer than usual</Text>
      <Text style={styles.body}>{stallExplanation(stalledModelName)}</Text>
      <View style={styles.actions}>
        <PrimaryButton
          text="New chat with another model"
          onPress={onStartNewChat}
          disabled={disabled}
        />
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
      borderRadius: radius.twelve,
      padding: space.four,
      gap: space.two,
      marginBottom: space.six,
    },
    title: {
      ...textStyles.bodySecondaryMedium,
      color: theme.text.primary,
    },
    body: {
      ...textStyles.bodyTertiaryRegular,
      color: theme.text.defaultSecondary,
    },
    actions: {
      marginTop: space.two,
      gap: space.two,
    },
  });
