import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import type { FailedTurn } from '../../utils/devBenchmark/report';
import type { TurnAttempt } from '../../utils/devBenchmark/types';
import SecondaryButton from '../SecondaryButton';
import { VERDICT_LABELS, verdictColor } from './verdictColor';

interface Props {
  failedTurn: FailedTurn | null;
  onClose: () => void;
}

const formatTimings = ({ timings }: TurnAttempt): string => {
  const ttft = timings.ttftMs === null ? '–' : `${timings.ttftMs} ms`;
  const speed =
    timings.tokPerS === null ? '–' : `${timings.tokPerS.toFixed(1)} tok/s`;
  return `First token ${ttft} · ${speed} · turn ${(timings.turnMs / 1000).toFixed(1)} s`;
};

export const TurnDetailModal = ({ failedTurn, onClose }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  const renderText = (label: string, value: string) => (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.body}>
        {value || '(empty)'}
      </Text>
    </View>
  );

  const renderAttempt = (attempt: TurnAttempt, index: number) => (
    <View key={index} style={styles.attempt}>
      <Text style={styles.attemptTitle}>
        {index === 0 ? 'First attempt' : 'Retry'}
      </Text>
      <Text style={styles.meta}>{formatTimings(attempt)}</Text>
      <Text style={styles.meta}>
        System prompt {attempt.systemChars} chars · {attempt.promptMessages}{' '}
        prompt messages
      </Text>
      {attempt.generationError &&
        renderText('Generation error', attempt.generationError)}
      {attempt.findings.map((item) => (
        <Text
          key={item.check}
          style={[
            styles.finding,
            { color: verdictColor(theme, item.severity) },
          ]}
        >
          {item.check}: expected {item.expected}, got {item.actual}
        </Text>
      ))}
      {renderText('Final', attempt.final)}
      {attempt.raw !== attempt.final && renderText('Raw', attempt.raw)}
      {attempt.tidied !== attempt.raw && renderText('Tidied', attempt.tidied)}
      {attempt.retries.map((retry, retryIndex) =>
        renderText(
          `Guard retry ${retryIndex + 1}: ${retry.reason} (${retry.accepted ? 'accepted' : 'rejected'})`,
          retry.raw ?? ''
        )
      )}
    </View>
  );

  return (
    <Modal
      visible={failedTurn !== null}
      animationType="slide"
      onRequestClose={onClose}
    >
      {failedTurn && (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>
              {failedTurn.record.model} · {failedTurn.record.scenario} turn{' '}
              {failedTurn.record.turn}
            </Text>
            <Text
              style={[
                styles.verdict,
                { color: verdictColor(theme, failedTurn.turn.verdict) },
              ]}
            >
              {VERDICT_LABELS[failedTurn.turn.verdict]}
            </Text>
            {renderText('Question', failedTurn.record.question)}
            {failedTurn.turn.attempts.map(renderAttempt)}
          </ScrollView>
          <View style={styles.footer}>
            <SecondaryButton text="Close" onPress={onClose} />
          </View>
        </View>
      )}
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
      paddingTop: theme.insets.top,
    },
    content: {
      padding: 16,
      gap: 12,
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: theme.insets.bottom + 16,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.lg,
      color: theme.text.primary,
    },
    verdict: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
    },
    attempt: {
      gap: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.bg.softSecondary,
    },
    attemptTitle: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
    meta: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      color: theme.text.defaultTertiary,
    },
    finding: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
    },
    block: {
      gap: 4,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      color: theme.text.defaultTertiary,
    },
    body: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
  });
