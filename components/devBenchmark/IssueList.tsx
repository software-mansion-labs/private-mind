import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import {
  failedTurnSentence,
  regressionSentence,
  type FailedTurn,
  type ModelIssue,
  type Regression,
} from '../../utils/devBenchmark/report';
import { verdictColor } from './verdictColor';

interface Props {
  modelIssues: ModelIssue[];
  failedTurns: FailedTurn[];
  regressions: Regression[];
  onOpenTurn: (failedTurn: FailedTurn) => void;
}

export const IssueList = ({
  modelIssues,
  failedTurns,
  regressions,
  onOpenTurn,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  const renderDot = (severity: ModelIssue['severity']) => (
    <View
      style={[styles.dot, { backgroundColor: verdictColor(theme, severity) }]}
    />
  );

  const renderFailedTurn = (failedTurn: FailedTurn) => {
    const handlePress = () => onOpenTurn(failedTurn);
    const { record } = failedTurn;
    return (
      <Pressable
        key={`${record.model}-${record.scenario}-${record.turn}`}
        onPress={handlePress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {renderDot(record.severity)}
        <Text style={styles.text}>{failedTurnSentence(record)}</Text>
      </Pressable>
    );
  };

  if (
    modelIssues.length === 0 &&
    failedTurns.length === 0 &&
    regressions.length === 0
  ) {
    return <Text style={styles.empty}>Nothing red or yellow.</Text>;
  }

  return (
    <View style={styles.list}>
      {modelIssues.map((issue) => (
        <View key={`${issue.model}-${issue.summary}`} style={styles.row}>
          {renderDot(issue.severity)}
          <Text style={styles.text}>
            {issue.model}: {issue.summary}.
          </Text>
        </View>
      ))}
      {failedTurns.map(renderFailedTurn)}
      {regressions.map((regression) => (
        <View
          key={`${regression.model}-${regression.where}-${regression.metric}`}
          style={styles.row}
        >
          {renderDot('warn')}
          <Text style={styles.text}>{regressionSentence(regression)}</Text>
        </View>
      ))}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    list: {
      gap: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingVertical: 6,
    },
    pressed: {
      opacity: 0.6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 6,
    },
    text: {
      flex: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
    empty: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultTertiary,
    },
  });
