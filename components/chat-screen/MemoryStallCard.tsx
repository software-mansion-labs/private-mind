import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { radius, space, textStyles } from '../../constants/design-system';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';

type MemoryStallCardProps = {
  stalledModelName: string;
  didNotStart?: boolean;
  disabled?: boolean;
  onStartNewChat: () => void;
  onTryAgain: () => void;
};

const cardCopy = (modelName: string, didNotStart: boolean) =>
  didNotStart
    ? {
        title: `${modelName} couldn't start`,
        body: `Last time your phone ran out of memory while ${modelName} was starting, and the app closed. A smaller model in a new chat can answer right away.`,
      }
    : {
        title: 'This is taking longer than usual',
        body: `Your phone is short on memory right now, so ${modelName} is running very slowly. A smaller model in a new chat can answer right away.`,
      };

export default function MemoryStallCard({
  stalledModelName,
  didNotStart = false,
  disabled = false,
  onStartNewChat,
  onTryAgain,
}: MemoryStallCardProps) {
  const { styles } = useThemedStyles(createStyles);
  const copy = cardCopy(stalledModelName, didNotStart);

  return (
    <View style={styles.card} testID="memory-stall-card">
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
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
